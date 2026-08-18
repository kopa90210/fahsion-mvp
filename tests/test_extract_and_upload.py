import unittest

from extract_and_upload import normalize_attributes, validate_attributes


class NormalizeAttributesTests(unittest.TestCase):
    def test_category_aliases_are_canonicalized(self) -> None:
        attributes = {
            "category": "Running Shoe",
            "layer_role": "footwear",
            "subcategory": "sneaker",
            "display_name": "Black Sneaker",
            "color": {"primary": "black"},
            "material": {"primary": "synthetic"},
            "fit": {"weights": {"regular": 1.0}},
            "pattern": "solid",
            "style_tags": {"minimal": 0.5},
            "formality_score": 0.2,
            "season_weights": {"spring": 1.0},
            "model_confidence": 0.8,
        }

        normalized = normalize_attributes(attributes)

        self.assertEqual(normalized["category"], "footwear")
        self.assertEqual(normalized["layer_role"], "footwear")

    def test_unknown_categories_are_rejected(self) -> None:
        attributes = {
            "category": "mystery",
            "subcategory": "thing",
            "display_name": "Mystery Item",
            "color": {"primary": "black"},
            "material": {"primary": "synthetic"},
            "fit": {"weights": {"regular": 1.0}},
            "pattern": "solid",
            "style_tags": {"minimal": 0.5},
            "formality_score": 0.2,
            "season_weights": {"spring": 1.0},
            "model_confidence": 0.8,
        }

        problems = validate_attributes(attributes, 0.6)

        self.assertTrue(any("category" in problem for problem in problems))


# ---------------------------------------------------------------------------
# Style-tags schema contract
#
# These tests assert that every key produced by EXTRACTION_PROMPT is a member
# of the eight STYLE_DIMENSIONS defined in src/lib/quiz/scoring.ts.
# The eight values are hardcoded here (no cross-language import) so a future
# divergence between the TypeScript constant and this test is itself a signal.
# ---------------------------------------------------------------------------

# The canonical set — must stay in sync with STYLE_DIMENSIONS in scoring.ts
STYLE_DIMENSIONS = frozenset(
    {"minimal", "streetwear", "formal", "bohemian", "edgy", "earth_tones", "smart_casual", "sporty"}
)


class StyleTagsSchemaTests(unittest.TestCase):
    """Ensure style_tags keys align with STYLE_DIMENSIONS."""

    def _assert_all_keys_valid(self, style_tags: dict) -> None:
        invalid = set(style_tags.keys()) - STYLE_DIMENSIONS
        self.assertEqual(
            invalid,
            set(),
            f"style_tags contains keys not in STYLE_DIMENSIONS: {invalid}",
        )

    def _assert_any_key_invalid(self, style_tags: dict) -> None:
        invalid = set(style_tags.keys()) - STYLE_DIMENSIONS
        self.assertNotEqual(
            invalid,
            set(),
            "Expected at least one key outside STYLE_DIMENSIONS but found none.",
        )

    # -- old (broken) key set must fail the membership check -----------------

    def test_old_prompt_keys_fail_membership(self) -> None:
        """Keys that have never been STYLE_DIMENSIONS must still be rejected.

        The original pre-fix prompt also contained 'vintage' and 'preppy'-style
        hallucinations; this test documents that class of invalid key.
        smart_casual/sporty are no longer in this set — they are now valid.
        """
        keys_with_invalid = {
            "minimal": 0.0,
            "streetwear": 0.0,
            "formal": 0.0,
            "bohemian": 0.0,
            "edgy": 0.0,
            "earth_tones": 0.0,
            "smart_casual": 0.0,
            "sporty": 0.0,
            "vintage": 0.9,   # never a STYLE_DIMENSION
        }
        self._assert_any_key_invalid(keys_with_invalid)

    # -- new (correct) key set must pass the membership check ----------------

    def test_new_prompt_keys_pass_membership(self) -> None:
        """All eight keys in the fixed prompt must be members of STYLE_DIMENSIONS."""
        new_style_tags = {
            "minimal": 0.8,
            "streetwear": 0.1,
            "formal": 0.0,
            "bohemian": 0.0,
            "edgy": 0.1,
            "earth_tones": 0.0,
            "smart_casual": 0.0,
            "sporty": 0.0,
        }
        self._assert_all_keys_valid(new_style_tags)

    def test_partial_style_tags_pass_membership(self) -> None:
        """A real model response may omit some keys; remaining keys must all be valid."""
        partial = {"minimal": 0.7, "edgy": 0.3}
        self._assert_all_keys_valid(partial)

    def test_extra_unknown_key_fails_membership(self) -> None:
        """An unexpected key (e.g. future model hallucination) must be caught."""
        hallucinated = {
            "minimal": 0.5,
            "streetwear": 0.3,
            "formal": 0.0,
            "bohemian": 0.0,
            "edgy": 0.2,
            "earth_tones": 0.0,
            "preppy": 0.9,  # not a STYLE_DIMENSION
        }
        self._assert_any_key_invalid(hallucinated)

