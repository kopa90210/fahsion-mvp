import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv
from supabase import create_client


def load_environment() -> None:
    load_dotenv(".env")
    load_dotenv(".env.local", override=False)

    if not os.getenv("SUPABASE_URL") and os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = os.environ["NEXT_PUBLIC_SUPABASE_URL"]


def parse_datetime(dt_str: str) -> datetime:
    """Parses ISO 8601 string to UTC datetime object."""
    if not dt_str:
        return datetime.now(timezone.utc)
    dt_str = dt_str.replace("Z", "+00:00")
    dt = datetime.fromisoformat(dt_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def generate_report(supabase: Any) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    cutoff_7d = now - timedelta(days=7)
    cutoff_iso = cutoff_7d.isoformat()

    # 1. Fetch feedback rows for the last 7 days
    feedback_response = (
        supabase.table("feedback")
        .select("id, user_id, outfit_id, liked, source, created_at")
        .gte("created_at", cutoff_iso)
        .execute()
    )
    feedback_7d = feedback_response.data or []

    # Segment like rates and swipe counts by source ('daily' vs 'calibration')
    daily_swipes = [f for f in feedback_7d if f.get("source") == "daily"]
    calibration_swipes = [f for f in feedback_7d if f.get("source") == "calibration"]

    daily_count = len(daily_swipes)
    daily_likes = sum(1 for f in daily_swipes if f.get("liked"))
    daily_like_rate = (daily_likes / daily_count * 100) if daily_count > 0 else 0.0

    calibration_count = len(calibration_swipes)
    calibration_likes = sum(1 for f in calibration_swipes if f.get("liked"))
    calibration_like_rate = (
        (calibration_likes / calibration_count * 100) if calibration_count > 0 else 0.0
    )

    # 2. Signal-quality metrics (active users & avg swipes/user for 7d)
    active_user_ids = {f.get("user_id") for f in feedback_7d if f.get("user_id")}
    active_users_count = len(active_user_ids)
    total_swipes = len(feedback_7d)
    avg_swipes_per_user = (
        (total_swipes / active_users_count) if active_users_count > 0 else 0.0
    )

    # 3. D1 Return Rate calculation
    users_response = supabase.table("users").select("id, created_at").execute()
    all_users = users_response.data or []

    all_feedback_response = (
        supabase.table("feedback")
        .select("user_id, created_at")
        .execute()
    )
    all_feedback = all_feedback_response.data or []

    user_feedback_timestamps: dict[str, list[datetime]] = {}
    for f in all_feedback:
        uid = f.get("user_id")
        if uid and f.get("created_at"):
            ts = parse_datetime(f["created_at"])
            user_feedback_timestamps.setdefault(uid, []).append(ts)

    user_first_ts: dict[str, datetime] = {}
    for user in all_users:
        uid = user.get("id")
        if not uid:
            continue
        created_at = user.get("created_at")
        u_ts = parse_datetime(created_at) if created_at else now
        fb_tss = user_feedback_timestamps.get(uid, [])
        first_ts = min([u_ts] + fb_tss) if fb_tss else u_ts
        user_first_ts[uid] = first_ts

    # Cohort: Users whose first activity occurred in the last 7 days (and at least 1 day ago)
    cohort_cutoff_start = now - timedelta(days=8)
    cohort_cutoff_end = now - timedelta(days=1)

    d1_eligible_users = [
        uid
        for uid, first_ts in user_first_ts.items()
        if cohort_cutoff_start <= first_ts <= cohort_cutoff_end
    ]

    returned_d1_count = 0
    for uid in d1_eligible_users:
        first_ts = user_first_ts[uid]
        first_date = first_ts.date()
        target_d1_date = first_date + timedelta(days=1)

        fb_tss = user_feedback_timestamps.get(uid, [])
        has_d1_return = any(
            ts.date() == target_d1_date or (24 * 3600 <= (ts - first_ts).total_seconds() <= 48 * 3600)
            for ts in fb_tss
        )
        if has_d1_return:
            returned_d1_count += 1

    d1_return_rate = (
        (returned_d1_count / len(d1_eligible_users) * 100)
        if d1_eligible_users
        else 0.0
    )

    return {
        "daily_like_rate": daily_like_rate,
        "daily_count": daily_count,
        "calibration_like_rate": calibration_like_rate,
        "calibration_count": calibration_count,
        "d1_return_rate": d1_return_rate,
        "active_users": active_users_count,
        "avg_swipes_per_user": avg_swipes_per_user,
    }


def main() -> int:
    try:
        load_environment()
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

        if not supabase_url or not supabase_key:
            print(
                "Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.",
                file=sys.stderr,
            )
            return 1

        supabase = create_client(supabase_url, supabase_key)
        report = generate_report(supabase)

        print(f"Daily like rate: {report['daily_like_rate']:.0f}% ({report['daily_count']} swipes)")
        print(f"Calibration like rate: {report['calibration_like_rate']:.0f}% ({report['calibration_count']} swipes)")
        print(f"D1 return rate: {report['d1_return_rate']:.0f}%")
        print(f"Active users (7d): {report['active_users']}, avg swipes/user: {report['avg_swipes_per_user']:.1f}")

        return 0
    except Exception as exc:
        print(f"Error generating report: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
