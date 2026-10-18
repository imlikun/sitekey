import { findFillTarget } from "./detector";

function setNativeValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function focusField(input: HTMLInputElement): void {
  input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
  input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  input.focus({ preventScroll: false });
  input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

export function fillCredentials(username: string, password: string): boolean {
  const target = findFillTarget();
  if (!target) return false;

  if (target.username) {
    setNativeValue(target.username, username);
    focusField(target.username);
  }
  setNativeValue(target.password, password);
  focusField(target.password);

  const submit = target.container.querySelector<HTMLElement>(
    'button[type="submit"], input[type="submit"], button',
  );
  submit?.focus({ preventScroll: true });
  return true;
}
