/**
 * Phase 4B Gate 3: Invariant & AI Result Validation
 *
 * Strict validation routines for pipeline domain contracts and external AI outputs.
 * In accordance with Gate 3 requirements:
 *  - Rejects invalid values and malformed responses.
 *  - Does not silently repair or guess missing data.
 *  - Provides structured error details without coupling to database/SDKs.
 */

import {
  WARDROBE_CATEGORIES,
  type CropBox,
  type Detection,
  type ExtractedAttributes,
  type ExtractionResult,
  type IsolationResult,
  type PrettifyResult,
  type WardrobeCategory,
} from './contracts';

export interface ValidationErrorDetail {
  path: string;
  message: string;
  received?: unknown;
}

export type ValidationResult<T> =
  | { success: true; data: T; errors?: never }
  | { success: false; data?: never; errors: ValidationErrorDetail[] };

export class AIContractValidationError extends Error {
  public readonly errors: ValidationErrorDetail[];
  public readonly stage?: string;

  constructor(message: string, errors: ValidationErrorDetail[], stage?: string) {
    super(`${message}: ${errors.map((e) => `[${e.path}] ${e.message}`).join(', ')}`);
    this.name = 'AIContractValidationError';
    this.errors = errors;
    this.stage = stage;
  }
}

/**
 * Throws AIContractValidationError if validation failed, otherwise returns validated data.
 */
export function assertValid<T>(result: ValidationResult<T>, contextName = 'Validation'): T {
  if (!result.success) {
    throw new AIContractValidationError(`${contextName} failed`, result.errors);
  }
  return result.data;
}

const EPSILON = 1e-9;

/**
 * Validates CropBox coordinates and invariants:
 *  - 0 <= x < 1
 *  - 0 <= y < 1
 *  - 0 < width <= 1
 *  - 0 < height <= 1
 *  - x + width <= 1
 *  - y + height <= 1
 *  - All values must be finite numbers
 */
export function validateCropBox(box: unknown, basePath = 'box'): ValidationResult<CropBox> {
  const errors: ValidationErrorDetail[] = [];

  if (typeof box !== 'object' || box === null) {
    return {
      success: false,
      errors: [{ path: basePath, message: 'CropBox must be a non-null object', received: box }],
    };
  }

  const { x, y, width, height } = box as Record<string, unknown>;

  // Type & finiteness checks
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    errors.push({ path: `${basePath}.x`, message: 'x must be a finite number', received: x });
  }
  if (typeof y !== 'number' || !Number.isFinite(y)) {
    errors.push({ path: `${basePath}.y`, message: 'y must be a finite number', received: y });
  }
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    errors.push({ path: `${basePath}.width`, message: 'width must be a finite number', received: width });
  }
  if (typeof height !== 'number' || !Number.isFinite(height)) {
    errors.push({ path: `${basePath}.height`, message: 'height must be a finite number', received: height });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const nx = x as number;
  const ny = y as number;
  const nw = width as number;
  const nh = height as number;

  // Invariant: 0 <= x < 1
  if (nx < 0 || nx >= 1) {
    errors.push({ path: `${basePath}.x`, message: 'x must satisfy 0 <= x < 1', received: nx });
  }

  // Invariant: 0 <= y < 1
  if (ny < 0 || ny >= 1) {
    errors.push({ path: `${basePath}.y`, message: 'y must satisfy 0 <= y < 1', received: ny });
  }

  // Invariant: 0 < width <= 1
  if (nw <= 0 || nw > 1) {
    errors.push({ path: `${basePath}.width`, message: 'width must satisfy 0 < width <= 1', received: nw });
  }

  // Invariant: 0 < height <= 1
  if (nh <= 0 || nh > 1) {
    errors.push({ path: `${basePath}.height`, message: 'height must satisfy 0 < height <= 1', received: nh });
  }

  // Invariant: x + width <= 1
  if (nx + nw > 1 + EPSILON) {
    errors.push({
      path: `${basePath}.x + width`,
      message: 'x + width must satisfy x + width <= 1',
      received: nx + nw,
    });
  }

  // Invariant: y + height <= 1
  if (ny + nh > 1 + EPSILON) {
    errors.push({
      path: `${basePath}.y + height`,
      message: 'y + height must satisfy y + height <= 1',
      received: ny + nh,
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { x: nx, y: ny, width: nw, height: nh },
  };
}

/**
 * Validates confidence score in range [0, 1].
 */
export function validateConfidence(
  confidence: unknown,
  path = 'confidence'
): ValidationResult<number> {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return {
      success: false,
      errors: [{ path, message: 'Confidence must be a finite number', received: confidence }],
    };
  }

  if (confidence < 0 || confidence > 1) {
    return {
      success: false,
      errors: [{ path, message: 'Confidence must be between 0 and 1 inclusive', received: confidence }],
    };
  }

  return { success: true, data: confidence };
}

/**
 * Validates an image URL string.
 */
export function validateImageUrl(url: unknown, path = 'imageUrl'): ValidationResult<string> {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return {
      success: false,
      errors: [{ path, message: 'Image URL must be a non-empty string', received: url }],
    };
  }

  const trimmed = url.trim();
  // Valid URL protocols: http, https, data:, or relative/mock scheme
  const hasValidProtocol =
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('mock://') ||
    trimmed.startsWith('/');

  if (!hasValidProtocol) {
    return {
      success: false,
      errors: [{ path, message: 'Image URL must have a valid protocol (http, https, data, mock, /)', received: url }],
    };
  }

  return { success: true, data: trimmed };
}

/**
 * Validates wardrobe category against canonical taxonomy.
 */
export function validateCategory(
  category: unknown,
  path = 'category'
): ValidationResult<WardrobeCategory> {
  if (typeof category !== 'string' || !WARDROBE_CATEGORIES.includes(category as WardrobeCategory)) {
    return {
      success: false,
      errors: [
        {
          path,
          message: `Category must be one of: ${WARDROBE_CATEGORIES.join(', ')}`,
          received: category,
        },
      ],
    };
  }

  return { success: true, data: category as WardrobeCategory };
}

/**
 * Validates a single Detection output.
 */
export function validateDetection(
  detection: unknown,
  basePath = 'detection'
): ValidationResult<Detection> {
  if (typeof detection !== 'object' || detection === null) {
    return {
      success: false,
      errors: [{ path: basePath, message: 'Detection must be a non-null object', received: detection }],
    };
  }

  const d = detection as Record<string, unknown>;
  const errors: ValidationErrorDetail[] = [];

  const boxRes = validateCropBox(d.box, `${basePath}.box`);
  if (!boxRes.success) errors.push(...boxRes.errors);

  const catRes = validateCategory(d.category, `${basePath}.category`);
  if (!catRes.success) errors.push(...catRes.errors);

  const confRes = validateConfidence(d.confidence, `${basePath}.confidence`);
  if (!confRes.success) errors.push(...confRes.errors);

  if (d.label !== undefined && typeof d.label !== 'string') {
    errors.push({ path: `${basePath}.label`, message: 'Label if provided must be a string', received: d.label });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      box: boxRes.data!,
      category: catRes.data!,
      confidence: confRes.data!,
      ...(d.label !== undefined ? { label: d.label as string } : {}),
    },
  };
}

/**
 * Validates a collection of detections.
 */
export function validateDetections(
  detections: unknown,
  path = 'detections'
): ValidationResult<Detection[]> {
  if (!Array.isArray(detections)) {
    return {
      success: false,
      errors: [{ path, message: 'Detections must be an array', received: detections }],
    };
  }

  const validItems: Detection[] = [];
  const errors: ValidationErrorDetail[] = [];

  for (let i = 0; i < detections.length; i++) {
    const itemRes = validateDetection(detections[i], `${path}[${i}]`);
    if (!itemRes.success) {
      errors.push(...itemRes.errors);
    } else {
      validItems.push(itemRes.data);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: validItems };
}

/**
 * Validates an IsolationResult output.
 */
export function validateIsolationResult(
  result: unknown,
  basePath = 'isolationResult'
): ValidationResult<IsolationResult> {
  if (typeof result !== 'object' || result === null) {
    return {
      success: false,
      errors: [{ path: basePath, message: 'IsolationResult must be a non-null object', received: result }],
    };
  }

  const r = result as Record<string, unknown>;
  const errors: ValidationErrorDetail[] = [];

  const urlRes = validateImageUrl(r.rawImageUrl, `${basePath}.rawImageUrl`);
  if (!urlRes.success) errors.push(...urlRes.errors);

  const boxRes = validateCropBox(r.box, `${basePath}.box`);
  if (!boxRes.success) errors.push(...boxRes.errors);

  const confRes = validateConfidence(r.confidence, `${basePath}.confidence`);
  if (!confRes.success) errors.push(...confRes.errors);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      rawImageUrl: urlRes.data!,
      box: boxRes.data!,
      confidence: confRes.data!,
    },
  };
}

/**
 * Validates ExtractedAttributes.
 * Enforces required fields: category, displayName, color (with primary).
 */
export function validateExtractedAttributes(
  attrs: unknown,
  basePath = 'attributes'
): ValidationResult<ExtractedAttributes> {
  if (typeof attrs !== 'object' || attrs === null) {
    return {
      success: false,
      errors: [{ path: basePath, message: 'ExtractedAttributes must be a non-null object', received: attrs }],
    };
  }

  const a = attrs as Record<string, unknown>;
  const errors: ValidationErrorDetail[] = [];

  // Required: category
  const catRes = validateCategory(a.category, `${basePath}.category`);
  if (!catRes.success) errors.push(...catRes.errors);

  // Required: displayName
  if (typeof a.displayName !== 'string' || a.displayName.trim().length === 0) {
    errors.push({
      path: `${basePath}.displayName`,
      message: 'displayName is required and must be a non-empty string',
      received: a.displayName,
    });
  }

  // Required: color with primary
  if (typeof a.color !== 'object' || a.color === null) {
    errors.push({
      path: `${basePath}.color`,
      message: 'color is required and must be an object with primary color',
      received: a.color,
    });
  } else {
    const col = a.color as Record<string, unknown>;
    if (typeof col.primary !== 'string' || col.primary.trim().length === 0) {
      errors.push({
        path: `${basePath}.color.primary`,
        message: 'color.primary is required and must be a non-empty string',
        received: col.primary,
      });
    }
  }

  // Optional subcategory check
  if (a.subcategory !== undefined && a.subcategory !== null && typeof a.subcategory !== 'string') {
    errors.push({
      path: `${basePath}.subcategory`,
      message: 'subcategory if provided must be a string or null',
      received: a.subcategory,
    });
  }

  // Optional formalityScore check
  if (a.formalityScore !== undefined && a.formalityScore !== null) {
    if (typeof a.formalityScore !== 'number' || !Number.isFinite(a.formalityScore) || a.formalityScore < 0 || a.formalityScore > 1) {
      errors.push({
        path: `${basePath}.formalityScore`,
        message: 'formalityScore if provided must be a finite number between 0 and 1',
        received: a.formalityScore,
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: a as unknown as ExtractedAttributes,
  };
}

/**
 * Validates ExtractionResult.
 * Validates rawImageUrl, overall confidence, confidencePerField, and attributes.
 */
export function validateExtractionResult(
  result: unknown,
  basePath = 'extractionResult'
): ValidationResult<ExtractionResult> {
  if (typeof result !== 'object' || result === null) {
    return {
      success: false,
      errors: [{ path: basePath, message: 'ExtractionResult must be a non-null object', received: result }],
    };
  }

  const r = result as Record<string, unknown>;
  const errors: ValidationErrorDetail[] = [];

  const urlRes = validateImageUrl(r.rawImageUrl, `${basePath}.rawImageUrl`);
  if (!urlRes.success) errors.push(...urlRes.errors);

  const confRes = validateConfidence(r.confidence, `${basePath}.confidence`);
  if (!confRes.success) errors.push(...confRes.errors);

  // Validate confidencePerField
  if (typeof r.confidencePerField !== 'object' || r.confidencePerField === null || Array.isArray(r.confidencePerField)) {
    errors.push({
      path: `${basePath}.confidencePerField`,
      message: 'confidencePerField must be a non-null object containing field confidences',
      received: r.confidencePerField,
    });
  } else {
    const cpf = r.confidencePerField as Record<string, unknown>;
    for (const [field, score] of Object.entries(cpf)) {
      const scoreRes = validateConfidence(score, `${basePath}.confidencePerField.${field}`);
      if (!scoreRes.success) errors.push(...scoreRes.errors);
    }
  }

  // Validate attributes
  const attrRes = validateExtractedAttributes(r.attributes, `${basePath}.attributes`);
  if (!attrRes.success) errors.push(...attrRes.errors);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      rawImageUrl: urlRes.data!,
      confidence: confRes.data!,
      confidencePerField: r.confidencePerField as Record<string, number>,
      attributes: attrRes.data!,
    },
  };
}

/**
 * Validates PrettifyResult.
 * Ensures status is valid and if 'done', prettifiedImageUrl is present and valid.
 */
export function validatePrettifyResult(
  result: unknown,
  basePath = 'prettifyResult'
): ValidationResult<PrettifyResult> {
  if (typeof result !== 'object' || result === null) {
    return {
      success: false,
      errors: [{ path: basePath, message: 'PrettifyResult must be a non-null object', received: result }],
    };
  }

  const r = result as Record<string, unknown>;
  const errors: ValidationErrorDetail[] = [];

  const allowedStatuses = ['done', 'failed', 'skipped'];
  if (typeof r.status !== 'string' || !allowedStatuses.includes(r.status)) {
    errors.push({
      path: `${basePath}.status`,
      message: `status must be one of: ${allowedStatuses.join(', ')}`,
      received: r.status,
    });
  }

  const origUrlRes = validateImageUrl(r.originalImageUrl, `${basePath}.originalImageUrl`);
  if (!origUrlRes.success) errors.push(...origUrlRes.errors);

  if (r.status === 'done') {
    const pretUrlRes = validateImageUrl(r.prettifiedImageUrl, `${basePath}.prettifiedImageUrl`);
    if (!pretUrlRes.success) errors.push(...pretUrlRes.errors);
  }

  if (r.status === 'failed') {
    if (typeof r.error !== 'string' || r.error.trim().length === 0) {
      errors.push({
        path: `${basePath}.error`,
        message: 'error message must be provided when status is "failed"',
        received: r.error,
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      status: r.status as PrettifyResult['status'],
      originalImageUrl: origUrlRes.data!,
      prettifiedImageUrl: (r.prettifiedImageUrl as string | null | undefined) ?? null,
      error: (r.error as string | null | undefined) ?? null,
    },
  };
}
