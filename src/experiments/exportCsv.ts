import type { Observation } from "./types";

type Cell = string | number | boolean | null | undefined;

function cell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function makeCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map(row => row.map(cell).join(",")).join("\r\n");
}

function output(obs: Observation, key: string): unknown {
  return (obs.outputs as Record<string, unknown>)[key];
}

function textOutput(obs: Observation, key: string): string | undefined {
  const value = output(obs, key);
  return typeof value === "string" ? value : undefined;
}

function numberOutput(obs: Observation, key: string): number | undefined {
  const value = output(obs, key);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function buildExperimentCsv(experimentId: string, observations: Observation[]): string {
  switch (experimentId) {
    case "ohms-law":
      return makeCsv(
        ["Reading", "Voltage (V)", "Current (A)", "Resistance (ohm)", "Power (W)", "Validity"],
        observations.map(obs => {
          const currentA = numberOutput(obs, "currentA") ?? (numberOutput(obs, "current") ?? 0) / 1000;
          const powerW = numberOutput(obs, "powerW") ?? (numberOutput(obs, "power") ?? 0) / 1000;
          return [obs.id, obs.inputs.voltage, currentA, obs.inputs.resistance, powerW, textOutput(obs, "validity")];
        }),
      );
    case "series-parallel":
      return makeCsv(
        ["Reading", "Topology", "Source/Total Voltage (V)", "Total Current (A)", "Equivalent Resistance (ohm)", "Resistors (ohm)", "Validity"],
        observations.map(obs => [
          obs.id,
          numberOutput(obs, "configuration") === 1 ? "Series" : numberOutput(obs, "configuration") === 2 ? "Parallel" : "",
          numberOutput(obs, "voltage"),
          numberOutput(obs, "totalCurrentA") ?? (numberOutput(obs, "current") ?? 0) / 1000,
          numberOutput(obs, "equivalentResistanceOhms") ?? numberOutput(obs, "resistance"),
          textOutput(obs, "resistorValuesOhms"),
          textOutput(obs, "validity"),
        ]),
      );
    case "oxalic-acid-titration":
      return makeCsv(
        ["Reading", "Delivered KMnO4 (mL)", "KMnO4 Molarity (mol/L)", "Calculated KMnO4 Molarity (mol/L)", "Endpoint Assessment", "Flask Temperature (deg C)", "Procedural Status", "Issues"],
        observations.map(obs => [
          obs.id,
          numberOutput(obs, "volAdded") ?? obs.inputs.volumeAdded,
          numberOutput(obs, "actualTitrantMolarity"),
          numberOutput(obs, "calculatedTitrantMolarity"),
          textOutput(obs, "assessment"),
          obs.inputs.flaskTemperature,
          textOutput(obs, "usability"),
          Array.isArray(output(obs, "issueCodes")) ? (output(obs, "issueCodes") as string[]).join("; ") : "",
        ]),
      );
    case "mohrs-salt-titration":
      return makeCsv(
        ["Reading", "Delivered KMnO4 (mL)", "KMnO4 Molarity (mol/L)", "Calculated KMnO4 Molarity (mol/L)", "Endpoint Assessment", "Procedural Status", "Issues"],
        observations.map(obs => [
          obs.id,
          numberOutput(obs, "volAdded") ?? obs.inputs.volumeAdded,
          numberOutput(obs, "actualTitrantMolarity"),
          numberOutput(obs, "calculatedTitrantMolarity"),
          textOutput(obs, "assessment"),
          textOutput(obs, "usability"),
          Array.isArray(output(obs, "issueCodes")) ? (output(obs, "issueCodes") as string[]).join("; ") : "",
        ]),
      );
    default:
      throw new Error(`Unsupported experiment for CSV export: ${experimentId}`);
  }
}

export function downloadExperimentCsv(experimentId: string, observations: Observation[], filename: string): void {
  const blob = new Blob([buildExperimentCsv(experimentId, observations)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
