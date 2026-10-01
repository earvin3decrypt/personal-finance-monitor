export function applyBlurAmounts(enabled: boolean) {
  document.documentElement.dataset.blurAmounts = enabled ? "true" : "false";
}

export function blurAmountsInitScript(enabled: boolean): string {
  return `(function(){document.documentElement.dataset.blurAmounts=${JSON.stringify(enabled ? "true" : "false")};})();`;
}
