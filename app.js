const STORAGE_KEY = "ledger-expenses";
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

const form = document.querySelector("#expense-form");
const message = document.querySelector("#form-message");
const list = document.querySelector("#expense-list");
const emptyState = document.querySelector("#empty-state");
const totalAmount = document.querySelector("#total-amount");
const expenseCount = document.querySelector("#expense-count");
const clearButton = document.querySelector("#clear-button");
const dateInput = document.querySelector("#date");
const periodInput = document.querySelector("#period");
const viewModeInput = document.querySelector("#view-mode");
const categoryFilter = document.querySelector("#filter-category");
const searchInput = document.querySelector("#search");

let expenses = loadExpenses();
let editingId = null;
dateInput.value = today();
populateCategoryFilter();
renderExpenses();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = readForm();

  if (!data.description || !data.date || data.quantity < 1 || !Number.isFinite(data.amount) || data.amount <= 0) {
    message.className = "form-message error-message";
    message.textContent = "Enter an item, valid quantity, amount, and date.";
    return;
  }

  if (editingId) {
    expenses = expenses.map((expense) => expense.id === editingId ? { ...expense, ...data } : expense);
    message.textContent = "Expense updated.";
  } else {
    expenses.push({ id: crypto.randomUUID(), ...data });
    message.textContent = "Expense added.";
  }

  message.className = "form-message success-message";

  saveExpenses();
  resetForm();
  renderExpenses();
});

clearButton.addEventListener("click", () => {
  if (!expenses.length || !window.confirm("Clear all expenses?")) return;
  expenses = [];
  saveExpenses();
  renderExpenses();
});

searchInput.addEventListener("input", renderExpenses);
categoryFilter.addEventListener("change", renderExpenses);
viewModeInput.addEventListener("change", () => {
  updatePeriodOptions();
  renderExpenses();
});
periodInput.addEventListener("change", renderExpenses);
document.querySelector("#cancel-edit").addEventListener("click", resetForm);

function loadExpenses() {
  try {
    const savedExpenses = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(savedExpenses) ? savedExpenses.map(normalizeExpense) : [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function renderExpenses() {
  populateCategoryFilter();
  updatePeriodOptions();
  const visibleExpenses = getVisibleExpenses();
  const total = visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  totalAmount.textContent = currency.format(total);
  document.querySelector("#total-caption").textContent = getPeriodCaption();
  expenseCount.textContent = visibleExpenses.length;
  clearButton.hidden = expenses.length === 0;
  emptyState.hidden = visibleExpenses.length > 0;
  list.innerHTML = visibleExpenses
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(createExpenseMarkup)
    .join("");
  renderPeriodSummary(visibleExpenses);
  list.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", () => removeExpense(button.dataset.id));
  });
  list.querySelectorAll(".edit-button").forEach((button) => {
    button.addEventListener("click", () => startEdit(button.dataset.id));
  });
}

function createExpenseMarkup(expense) {
  const safeDescription = escapeHtml(expense.description || expense.category);
  const safeCategory = escapeHtml(expense.category);
  const formattedDate = dateFormatter.format(new Date(`${expense.date}T12:00:00`));
  const categoryLetter = safeDescription.charAt(0).toUpperCase();
  const details = [expense.vendor, expense.paymentMode, `Qty ${expense.quantity} ${expense.quantityUnit}`, expense.remarks]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");
  return `
    <article class="expense-row">
      <div class="expense-info">
        <span class="category-mark" aria-hidden="true">${categoryLetter}</span>
        <div>
          <p class="expense-name">${safeDescription}</p>
          <p class="expense-date">${safeCategory} &middot; ${formattedDate}</p>
          <p class="expense-meta">${details}</p>
        </div>
      </div>
      <div class="expense-actions">
        <p class="expense-amount">${currency.format(expense.amount)}</p>
        <button class="edit-button" type="button" data-id="${expense.id}">Edit</button>
        <button class="delete-button" type="button" data-id="${expense.id}" aria-label="Delete ${safeDescription} expense">&times;</button>
      </div>
    </article>`;
}

function removeExpense(id) {
  expenses = expenses.filter((expense) => expense.id !== id);
  saveExpenses();
  renderExpenses();
}

function readForm() {
  return {
    description: document.querySelector("#description").value.trim(),
    date: dateInput.value,
    quantity: Number(document.querySelector("#quantity").value),
    quantityUnit: document.querySelector("#quantityUnit").value,
    amount: Number.parseFloat(document.querySelector("#amount").value),
    paymentMode: document.querySelector("#paymentMode").value,
    vendor: document.querySelector("#vendor").value.trim(),
    remarks: document.querySelector("#remarks").value.trim(),
    category: document.querySelector("#category").value,
  };
}

function startEdit(id) {
  const expense = expenses.find((item) => item.id === id);
  if (!expense) return;
  editingId = id;
  Object.entries(expense).forEach(([key, value]) => {
    const input = document.querySelector(`#${key}`);
    if (input) input.value = value;
  });
  document.querySelector("#form-label").textContent = "Edit entry";
  document.querySelector("#form-title").textContent = "Update expense";
  document.querySelector("#submit-label").textContent = "Save changes";
  document.querySelector("#cancel-edit").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  editingId = null;
  form.reset();
  dateInput.value = today();
  document.querySelector("#quantity").value = 1;
  document.querySelector("#form-label").textContent = "New entry";
  document.querySelector("#form-title").textContent = "Log an expense";
  document.querySelector("#submit-label").textContent = "Add expense";
  document.querySelector("#cancel-edit").hidden = true;
}

function getVisibleExpenses() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const mode = viewModeInput.value;
  const period = periodInput.value;
  return expenses.filter((expense) => {
    const searchable = [expense.description, expense.vendor, expense.remarks].join(" ").toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesCategory = !category || expense.category === category;
    const matchesPeriod = mode === "all" || (mode === "month" ? expense.date.slice(0, 7) === period : expense.date.slice(0, 4) === period);
    return matchesSearch && matchesCategory && matchesPeriod;
  });
}

function updatePeriodOptions() {
  const mode = viewModeInput.value;
  const values = [...new Set(expenses.map((expense) => mode === "month" ? expense.date.slice(0, 7) : expense.date.slice(0, 4)))].sort().reverse();
  periodInput.hidden = mode === "all";
  periodInput.innerHTML = values.map((value) => `<option value="${value}">${mode === "month" ? formatMonth(value) : value}</option>`).join("");
  if (values.length && !values.includes(periodInput.value)) periodInput.value = values[0];
}

function populateCategoryFilter() {
  const current = categoryFilter.value;
  const categories = [...new Set(["Food", "Transport", "Home", "Shopping", "Bills", "Other", ...expenses.map((expense) => expense.category)])].sort();
  categoryFilter.innerHTML = `<option value="">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
  categoryFilter.value = categories.includes(current) ? current : "";
}

function renderPeriodSummary(visibleExpenses) {
  const mode = viewModeInput.value;
  const summary = document.querySelector("#period-summary");
  if (mode === "all") {
    summary.innerHTML = "";
    return;
  }
  const groups = visibleExpenses.reduce((result, expense) => {
    const key = mode === "month" ? expense.date.slice(0, 7) : expense.date.slice(0, 4);
    result[key] = (result[key] || 0) + expense.amount;
    return result;
  }, {});
  summary.innerHTML = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)).map(([key, total]) =>
    `<div class="summary-chip"><span>${mode === "month" ? formatMonth(key) : key}</span><strong>${currency.format(total)}</strong></div>`
  ).join("");
}

function getPeriodCaption() {
  if (viewModeInput.value === "month" && periodInput.value) return formatMonth(periodInput.value);
  if (viewModeInput.value === "year" && periodInput.value) return periodInput.value;
  return "All expenses";
}

function formatMonth(value) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00`));
}

function normalizeExpense(expense) {
  return {
    id: expense.id || crypto.randomUUID(),
    description: String(expense.description || ""),
    date: expense.date || today(),
    quantity: Number(expense.quantity) || 1,
    quantityUnit: expense.quantityUnit || "pcs",
    amount: Number(expense.amount) || 0,
    paymentMode: expense.paymentMode || "Other",
    vendor: String(expense.vendor || ""),
    remarks: String(expense.remarks || ""),
    category: expense.category || "Other",
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  })[character]);
}
