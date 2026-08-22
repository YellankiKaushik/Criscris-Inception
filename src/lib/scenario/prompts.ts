export const LOW_PROMPT = `A realistic first-person industrial warehouse used for an
emergency-response training simulation.

Tall storage racks, machinery, emergency exits, fire-safety
equipment and multiple navigable aisles are visible.

A small amount of smoke is beginning to appear in the far
eastern section. Visibility is currently good. Lighting is
mostly normal.

Maintain a believable industrial environment, realistic scale,
consistent first-person perspective, and navigable spatial
continuity.`;

export const HIGH_PROMPT = `The industrial warehouse emergency is escalating.

Smoke is spreading rapidly through the eastern aisles.
Visibility is reduced near the affected area. Emergency alarms
and warning lights are active. The eastern part of the
warehouse is becoming increasingly hazardous.

Preserve the same warehouse identity and first-person spatial
continuity while clearly increasing the sense of urgency.`;

export const CRITICAL_PROMPT = `The industrial warehouse is now in a severe fire emergency.

Dense smoke fills much of the eastern section. Visibility near
the affected area is extremely poor. Emergency lights flash
through the building and conditions appear dangerous and
urgent.

Preserve the same warehouse identity and navigable first-person
environment while making the worsening emergency visually
obvious.`;

export const OBJECTIVES = {
  low: "Investigate the reported smoke and assess the situation.",
  high: "Conditions are deteriorating. Determine an appropriate response and prepare to evacuate.",
  critical: "Conditions are severe. Immediate evacuation is recommended.",
  complete: "Simulation complete. Review your response.",
  briefing: "Review the briefing, then start the simulation.",
} as const;
