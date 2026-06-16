export type DetachMechanism = "remount" | "pip" | "mirror" | "auto";

export type OrphanPolicy = "persist" | "snapshot" | "close";

export interface WidgetSize {
  width: number;
  height: number;
}

export interface DetachableWidgetDefinition {
  id: string;
  entry?: string;
  selector?: string;
  mechanism?: DetachMechanism;
  title: string;
  icon?: string;
  min_size?: WidgetSize;
  preferred_size?: WidgetSize;
  max_size?: WidgetSize;
  resizable?: boolean;
  always_on_top?: boolean;
  state_channel?: string;
  requires?: string[];
  orphan_policy?: OrphanPolicy;
  snap_zones?: string[];
}

export interface DetachableWidgetManifest {
  name: string;
  detachable_widgets: DetachableWidgetDefinition[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(manifest)) {
    return { valid: false, errors: ["Manifest must be an object."] };
  }

  if (typeof manifest.name !== "string" || manifest.name.length === 0) {
    errors.push("Manifest name must be a non-empty string.");
  }

  if (!Array.isArray(manifest.detachable_widgets)) {
    errors.push("Manifest detachable_widgets must be an array.");
    return { valid: errors.length === 0, errors };
  }

  manifest.detachable_widgets.forEach((widget, index) => {
    const label = `detachable_widgets[${index}]`;

    if (!isRecord(widget)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    if (typeof widget.id !== "string" || widget.id.length === 0) {
      errors.push(`${label}.id must be a non-empty string.`);
    }

    if (typeof widget.title !== "string" || widget.title.length === 0) {
      errors.push(`${label}.title must be a non-empty string.`);
    }

    const mechanism = typeof widget.mechanism === "string" ? widget.mechanism : "auto";
    if (!["remount", "pip", "mirror", "auto"].includes(mechanism)) {
      errors.push(`${label}.mechanism must be remount, pip, mirror, or auto.`);
    }

    if (mechanism === "remount" && typeof widget.entry !== "string") {
      errors.push(`${label}.entry is required when mechanism is remount.`);
    }

    if ((mechanism === "pip" || mechanism === "mirror") && typeof widget.selector !== "string") {
      errors.push(`${label}.selector is required when mechanism is ${mechanism}.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function assertValidManifest(manifest: unknown): asserts manifest is DetachableWidgetManifest {
  const result = validateManifest(manifest);
  if (!result.valid) {
    throw new Error(result.errors.join("\n"));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
