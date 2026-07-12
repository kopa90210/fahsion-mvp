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
