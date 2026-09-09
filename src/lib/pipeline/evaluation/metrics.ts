import type { Detection } from '../contracts';
import type { EvaluationMetric, GoldenExample } from './types';

export function intersectionOverUnion(left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }): number {
  const x1 = Math.max(left.x, right.x);
  const y1 = Math.max(left.y, right.y);
  const x2 = Math.min(left.x + left.width, right.x + right.width);
  const y2 = Math.min(left.y + left.height, right.y + right.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = left.width * left.height + right.width * right.height - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function evaluateDetection(example: GoldenExample, actual: Detection[]): EvaluationMetric[] {
  if (example.expected.garments.length === 0) return [{ name: 'detection_recall', value: 'NOT MEASURED' }];
  const categoryMatches = actual.filter((item) => example.expected.garments.some((expected) => expected.category === item.category));
  return [
    { name: 'detection_precision', value: actual.length === 0 ? 0 : categoryMatches.length / actual.length },
    { name: 'detection_recall', value: categoryMatches.length / example.expected.garments.length },
    { name: 'category_accuracy', value: categoryMatches.length / example.expected.garments.length },
  ];
}
