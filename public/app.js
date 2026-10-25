const form = document.querySelector("#planner-form");
const reviewPanel = document.querySelector("#review-panel");
const reviewList = document.querySelector("#review-list");
const loadingPanel = document.querySelector("#loading-panel");
const resultsPanel = document.querySelector("#results-panel");
const formError = document.querySelector("#form-error");
const resultError = document.querySelector("#result-error");
const ageInput = document.querySelector("#age");
const minorMessage = document.querySelector("#minor-message");
const generateButton = document.querySelector("#generate-plan");

const fieldMessages = {
  age: "Enter an age from 18 to 120.",
  height: "Enter a height within the range for your selected unit.",
  weight: "Enter a weight within the range for your selected unit.",
  activity: "Choose an activity level.",
  dietaryPattern: "Choose a dietary pattern.",
  consent: "Please review and agree before requesting suggestions."
};

function setFieldError(name, message) {
  const target = document.querySelector(`#${name}-error`);
  const input = document.querySelector(`[name="${name}"]`);
  if (target) target.textContent = message || "";
  if (input) {
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
}

function validateForm() {
  const data = new FormData(form);
  const errors = {};
  const age = Number(data.get("age"));
  const height = Number(data.get("height"));
  const weight = Number(data.get("weight"));
  if (!Number.isInteger(age) || age < 18 || age > 120) {
    errors.age = age < 18 ? "This tool is for adults. Please talk with a parent or guardian and a healthcare professional." : fieldMessages.age;
  }
  if (!Number.isFinite(height) || height <= 0 || (data.get("heightUnit") === "cm" && (height < 100 || height > 250)) || (data.get("heightUnit") === "in" && (height < 39 || height > 98))) errors.height = fieldMessages.height;
  if (!Number.isFinite(weight) || weight <= 0 || (data.get("weightUnit") === "kg" && (weight < 30 || weight > 350)) || (data.get("weightUnit") === "lb" && (weight < 66 || weight > 770))) errors.weight = fieldMessages.weight;
  if (!data.get("activity")) errors.activity = fieldMessages.activity;
  if (!data.get("dietaryPattern")) errors.dietaryPattern = fieldMessages.dietaryPattern;
  if (!data.get("consent")) errors.consent = fieldMessages.consent;

  for (const name of ["age", "height", "weight", "activity", "dietaryPattern", "consent"]) {
    setFieldError(name, errors[name] || "");
  }
  minorMessage.hidden = !(Number.isInteger(age) && age < 18);
  return errors;
}

function displayValue(name, data) {
  const labels = {
    activity: { low: "Mostly seated", light: "Light movement", moderate: "Regular movement", high: "Very active" },
    dietaryPattern: { "no-preference": "No specific pattern", omnivore: "Varied diet", vegetarian: "Vegetarian", vegan: "Vegan", pescatarian: "Pescatarian", other: "Another pattern" }
  };
  const value = data.get(name);
  if (!value) return "Not provided";
  if (name === "height") return `${value} ${data.get("heightUnit")}`;
  if (name === "weight") return `${value} ${data.get("weightUnit")}`;
  return labels[name]?.[value] || value;
}

function showReview() {
  const data = new FormData(form);
  const rows = [
    ["Age", `${data.get("age")} years`],
    ["Height", displayValue("height", data)],
    ["Weight", displayValue("weight", data)],
    ["Activity", displayValue("activity", data)],
    ["Dietary pattern", displayValue("dietaryPattern", data)],
    ["General goal", displayValue("goal", data)],
    ["Food preferences", displayValue("preferences", data)],
    ["Allergies or intolerances", displayValue("allergies", data)],
    ["Health conditions (optional)", displayValue("conditions", data)]
  ];
  reviewList.replaceChildren();
  for (const [label, value] of rows) {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    wrapper.append(term, detail);
    reviewList.append(wrapper);
  }
  reviewPanel.hidden = false;
  formError.hidden = true;
  reviewPanel.focus();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const errors = validateForm();
  if (Object.keys(errors).length) {
    const first = document.querySelector(`[name="${Object.keys(errors)[0]}"]`);
    first?.focus();
    return;
  }
  showReview();
});

ageInput.addEventListener("input", () => {
  const age = Number(ageInput.value);
  minorMessage.hidden = !(Number.isInteger(age) && age < 18);
  if (age >= 18) setFieldError("age", "");
});

document.querySelector("#edit-answers").addEventListener("click", () => {
  reviewPanel.hidden = true;
  form.querySelector("button[type=submit]").focus();
});

function addText(parent, tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function renderResults(result) {
  document.querySelector("#result-summary").textContent = result.summary;
  document.querySelector("#disclaimer").textContent = result.disclaimer;
  const safeMessage = document.querySelector("#safe-message");
  safeMessage.hidden = !result.safeRedirect;
  safeMessage.textContent = result.safeMessage || "Please consult a doctor or registered dietitian for individual advice.";
  document.querySelector("#meal-section").hidden = result.safeRedirect;
  document.querySelector("#limit-section").hidden = result.safeRedirect;
  document.querySelector("#habit-section").hidden = result.safeRedirect;

  const meals = document.querySelector("#meal-list");
  meals.replaceChildren();
  for (const meal of result.meals) {
    const article = document.createElement("article");
    article.className = "meal-item";
    addText(article, "h4", meal.name);
    addText(article, "p", meal.idea);
    addText(article, "p", meal.portion, "portion");
    meals.append(article);
  }

  const limitList = document.querySelector("#limit-list");
  limitList.replaceChildren();
  for (const item of result.limitFoods) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = `${item.food}: `;
    li.append(strong, document.createTextNode(item.reason));
    limitList.append(li);
  }

  for (const [id, items] of [["habit-list", result.habits], ["clinician-list", result.clinician]]) {
    const list = document.querySelector(`#${id}`);
    list.replaceChildren();
    for (const item of items) addText(list, "li", item);
  }
  resultsPanel.hidden = false;
  reviewPanel.hidden = true;
  loadingPanel.hidden = true;
  resultsPanel.focus();
}

generateButton.addEventListener("click", async () => {
  resultError.hidden = true;
  loadingPanel.hidden = false;
  reviewPanel.hidden = true;
  generateButton.disabled = true;
  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...Object.fromEntries(new FormData(form)),
        consent: form.elements.consent.checked
      })
    });
    const body = await response.json();
    if (!response.ok) {
      if (body.fields) {
        for (const [name, message] of Object.entries(body.fields)) setFieldError(name, message);
        loadingPanel.hidden = true;
        formError.textContent = body.error || "Please check your answers.";
        formError.hidden = false;
        form.hidden = false;
        reviewPanel.hidden = true;
        formError.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      throw new Error(body.error || "Suggestions are unavailable right now.");
    }
    renderResults(body);
  } catch (error) {
    loadingPanel.hidden = true;
    reviewPanel.hidden = false;
    resultError.textContent = error.message || "Suggestions are unavailable right now. Please try again.";
    resultError.hidden = false;
    reviewPanel.focus();
  } finally {
    generateButton.disabled = false;
  }
});

document.querySelector("#start-over").addEventListener("click", () => {
  resultsPanel.hidden = true;
  reviewPanel.hidden = true;
  form.hidden = false;
  form.reset();
  for (const name of [...Object.keys(fieldMessages)]) setFieldError(name, "");
  minorMessage.hidden = true;
  form.focus();
});
