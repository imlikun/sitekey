export interface QualifiedForm {
  password: HTMLInputElement;
  username: HTMLInputElement | null;
  container: HTMLElement;
  score: number;
  actionText: string;
}

const OTP_PATTERN =
  /(otp|one[-_\s]?time|vcode|verify|verification|captcha|sms|auth[-_\s]?code|dynamic|验证码|校验码|动态码|短信)/i;
const SEARCH_PATTERN = /(^|[-_])(q|query|search|keyword|wd|kw)([-_]|$)/i;
const USERNAME_PATTERN = /(user|login|account|email|mail|mobile|phone|uin|id|账号|帐号|邮箱|手机|用户名)/i;
const LOGIN_ACTION = /(登录|登入|登陆|立即登录|sign\s*in|log\s*in|login)/i;
const BAD_ACTION =
  /(注册|创建账号|创建帐户|创建账户|sign\s*up|register|create\s*account|重置|修改密码|忘记密码|找回密码|reset|forgot|change\s*password)/i;
const PAYMENT_PATTERN = /(card|cvv|cvc|creditcard|idcard|身份证|银行卡|支付密码)/i;

function probe(input: HTMLInputElement): string {
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute("aria-label") ?? "",
    input.autocomplete,
  ]
    .join(" ")
    .toLowerCase();
}

export function isVisible(element: HTMLElement): boolean {
  if (element.hidden) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}

function isEditable(input: HTMLInputElement): boolean {
  return !input.disabled && !input.readOnly && input.type !== "hidden";
}

export function isOtpField(input: HTMLInputElement): boolean {
  const autocomplete = (input.autocomplete || "").toLowerCase();
  if (autocomplete.includes("one-time-code")) return true;
  const text = probe(input);
  if (OTP_PATTERN.test(text)) return true;
  if (input.inputMode === "numeric" && input.maxLength > 0 && input.maxLength <= 8) return true;
  return false;
}

function isSearchField(input: HTMLInputElement): boolean {
  if (input.type === "search") return true;
  if (input.getAttribute("role") === "searchbox") return true;
  return SEARCH_PATTERN.test(probe(input));
}

function usernameScore(input: HTMLInputElement): number {
  if (input.type === "password") return -1;
  if (["checkbox", "radio", "hidden", "submit", "button", "file", "image"].includes(input.type)) return -1;
  if (isOtpField(input) || isSearchField(input)) return -1;

  const autocomplete = (input.autocomplete || "").toLowerCase();
  if (autocomplete.includes("username") || autocomplete.includes("email")) return 40;
  if (input.type === "email") return 36;
  if (input.type === "tel") return 30;
  if (USERNAME_PATTERN.test(probe(input))) return 28;
  if (input.type === "text" || input.type === "") return 8;
  return -1;
}

export function collectInputs(root: ParentNode = document, out: HTMLInputElement[] = [], depth = 0): HTMLInputElement[] {
  root.querySelectorAll("input").forEach((element) => out.push(element as HTMLInputElement));
  if (depth >= 6) return out;
  root.querySelectorAll("*").forEach((element) => {
    const shadow = (element as HTMLElement).shadowRoot;
    if (shadow) collectInputs(shadow, out, depth + 1);
  });
  return out;
}

function containerOf(password: HTMLInputElement): HTMLElement {
  return (
    password.closest<HTMLElement>("form") ??
    password.closest<HTMLElement>('[role="dialog"]') ??
    password.parentElement?.parentElement?.parentElement ??
    password.parentElement ??
    document.body
  );
}

function visibleInputs(container: HTMLElement): HTMLInputElement[] {
  return collectInputs(container).filter((input) => isEditable(input) && isVisible(input));
}

function findUsername(password: HTMLInputElement, container: HTMLElement): HTMLInputElement | null {
  const inputs = visibleInputs(container).filter((input) => input !== password);
  const all = collectInputs(container);
  const passwordIndex = all.indexOf(password);

  let best: { input: HTMLInputElement; score: number; distance: number } | null = null;
  for (const input of inputs) {
    const score = usernameScore(input);
    if (score <= 0) continue;
    const index = all.indexOf(input);
    const distance = index >= 0 && passwordIndex >= 0 ? Math.abs(passwordIndex - index) : 99;
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { input, score, distance };
    }
  }
  return best?.input ?? null;
}

function actionTextOf(container: HTMLElement): string {
  const candidates = container.querySelectorAll<HTMLElement>(
    'button, input[type="submit"], [role="button"]',
  );
  for (const element of candidates) {
    const text = (
      element.innerText ||
      (element as HTMLInputElement).value ||
      element.getAttribute("aria-label") ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");
    if (LOGIN_ACTION.test(text) || BAD_ACTION.test(text)) return text;
  }
  return "";
}

function pageHasLoginSignal(): boolean {
  return /(login|sign-?in|log-?in|auth|登录|登入|登陆)/i.test(
    `${location.href} ${document.title}`,
  );
}

export function qualifyPassword(password: HTMLInputElement): QualifiedForm | null {
  if (!isVisible(password) || !isEditable(password)) return null;
  if ((password.autocomplete || "").toLowerCase().includes("new-password")) return null;

  const container = containerOf(password);
  const inputs = visibleInputs(container);

  if (container.getAttribute("role") === "search") return null;
  if (inputs.some((input) => input !== password && PAYMENT_PATTERN.test(probe(input)))) return null;

  const confirm = inputs.some(
    (input) =>
      input !== password &&
      input.type === "password" &&
      /(confirm|repeat|new|再次|确认|重复)/i.test(`${input.name} ${input.id} ${input.autocomplete} ${input.placeholder}`),
  );
  if (confirm) return null;

  const username = findUsername(password, container);
  if (!username) return null;

  const actionText = actionTextOf(container);
  if (actionText && BAD_ACTION.test(actionText)) return null;

  let score = 40;
  score += 30;
  if (actionText && LOGIN_ACTION.test(actionText)) score += 20;
  if (pageHasLoginSignal()) score += 10;

  if (score < 60) return null;
  return { password, username, container, score, actionText };
}

export function findQualifiedForms(): QualifiedForm[] {
  const results: QualifiedForm[] = [];
  const seen = new Set<HTMLInputElement>();
  for (const input of collectInputs()) {
    if (input.type !== "password" || seen.has(input)) continue;
    seen.add(input);
    const qualified = qualifyPassword(input);
    if (qualified) results.push(qualified);
  }
  return results.sort((a, b) => b.score - a.score);
}

export function findBestForm(): QualifiedForm | null {
  return findQualifiedForms()[0] ?? null;
}

export function findFillTarget(): QualifiedForm | null {
  const qualified = findBestForm();
  if (qualified) return qualified;

  for (const input of collectInputs()) {
    if (input.type !== "password" || !isVisible(input) || !isEditable(input)) continue;
    const container = containerOf(input);
    const username = findUsername(input, container);
    if (username) {
      return { password: input, username, container, score: 0, actionText: "" };
    }
  }
  return null;
}

export function readCredentials(form: QualifiedForm): {
  username: string;
  password: string;
} | null {
  const username = form.username?.value.trim() ?? "";
  const password = form.password.value;
  if (!username || !password) return null;
  return { username, password };
}
