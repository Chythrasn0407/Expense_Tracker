const STORAGE_KEY = "ledger-expenses";
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

const form = document.querySelector("#expense-form");
const amountInput = document.querySelector("#amount");
const categoryInput = document.querySelector("#category");
const dateInput = document.querySelector("#date");
const message = document.querySelector("#form-message");
const list = document.querySelector("#expense-list");
const emptyState = document.querySelector("#empty-state");
const totalAmount = document.querySelector("#total-amount");
const expenseCount = document.querySelector("#expense-count");
const clearButton = document.querySelector("#clear-button");

let expenses = loadExpenses();
dateInput.value = new Date().toISOString().slice(0, 10);
renderExpenses();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number.parseFloat(amountInput.value);

  if (!Number.isFinite(amount) || amount <= 0 || !dateInput.value) {
    message.textContent = "Enter an amount greater than zero and choose a date.";
    return;
  }

  expenses.unshift({
    id: crypto.randomUUID(),
    amount,
    category: categoryInput.value,
    date: dateInput.value,
  });
  saveExpenses();
  renderExpenses();
  form.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
  message.textContent = "Expense added.";
  amountInput.focus();
});

clearButton.addEventListener("click", () => {
  if (!expenses.length || !window.confirm("Clear all expenses?")) return;
  expenses = [];
  saveExpenses();
  renderExpenses();
});

function loadExpenses() {
  try {
    const savedExpenses = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(savedExpenses) ? savedExpenses : [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function renderExpenses() {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  totalAmount.textContent = currency.format(total);
  expenseCount.textContent = expenses.length;
  clearButton.hidden = expenses.length === 0;
  emptyState.hidden = expenses.length > 0;
  list.innerHTML = expenses.map(createExpenseMarkup).join("");
  list.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", () => removeExpense(button.dataset.id));
  });
}

function createExpenseMarkup(expense) {
  const safeCategory = escapeHtml(expense.category);
  const formattedDate = dateFormatter.format(new Date(`${expense.date}T12:00:00`));
  const categoryLetter = safeCategory.charAt(0).toUpperCase();
  return `
    <article class="expense-row">
      <div class="expense-info">
        <span class="category-mark" aria-hidden="true">${categoryLetter}</span>
        <div>
          <p class="expense-name">${safeCategory}</p>
          <p class="expense-date">${formattedDate}</p>
        </div>
      </div>
      <div class="expense-actions">
        <p class="expense-amount">${currency.format(expense.amount)}</p>
        <button class="delete-button" type="button" data-id="${expense.id}" aria-label="Delete ${safeCategory} expense">&times;</button>
      </div>
    </article>`;
}

function removeExpense(id) {
  expenses = expenses.filter((expense) => expense.id !== id);
  saveExpenses();
  renderExpenses();
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  })[character]);
}
