export interface SituacaoTributariaOption {
  label: string;
  value: string;
}

const situacaoTributariaMap: Record<string, string> = {
  "500": "F00",
  "400": "N00",
  "300": "I00",
  "102": "T01",
};

export function useSituacaoTributaria() {
  const options: SituacaoTributariaOption[] = [
    { label: "500", value: "500" },
    { label: "400", value: "400" },
    { label: "300", value: "300" },
    { label: "102", value: "102" },
  ];

  function toBackend(value: string): string {
    return situacaoTributariaMap[value] ?? "";
  }

  function fromBackend(value: string): string {
    const entry = Object.entries(situacaoTributariaMap).find(
      ([, backendValue]) => backendValue === value
    );

    return entry?.[0] ?? "";
  }

  return {
    options,
    toBackend,
    fromBackend,
  };
}