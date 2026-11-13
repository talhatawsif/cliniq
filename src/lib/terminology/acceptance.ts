// M10 acceptance: query -> expected top-1 SNOMED CT code. Every code was confirmed with $lookup on the
// terminology server (SNOMED CT-AU 20261031) before being written here.
export const ACCEPTANCE: [query: string, code: string][] = [
  ["hypertension", "38341003"],
  ["HTN", "38341003"],
  ["type 2 diabetes mellitus", "44054006"],
  ["T2DM", "44054006"],
  ["chronic kidney disease", "709044004"],
  ["CKD", "709044004"],
  ["asthma", "195967001"],
  ["atrial fibrillation", "49436004"],
  ["AF", "49436004"],
  ["myocardial infarction", "22298006"],
  ["COPD", "13645005"],
  ["GORD", "235595009"],
  ["ischaemic heart disease", "414545008"],
  ["IHD", "414545008"],
  ["heart failure", "84114007"],
  ["pneumonia", "233604007"],
  ["anaemia", "271737000"],
];
export const NONSENSE = "xyzzy";
