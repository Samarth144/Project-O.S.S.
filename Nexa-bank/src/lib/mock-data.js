import { useState, useEffect } from "react";
export const user = {
    name: "Samarth Kumbhar",
    email: "samarthkumbhar8734@gmail.com",
    phone: "+91 98765 43210",
    avatar: "SK",
    kyc: "Verified",
    since: "March 2021",
    address: "12A, Marine Drive, Mumbai 400020",
    dob: "2000-05-15",
    pan: "ABCDE1234F",
};
// Helper to generate dynamic ISO dates relative to today
export const getRelativeDate = (daysAgo, hours = 10, minutes = 30) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
};
const getNextCreditDueDate = () => {
    const d = new Date();
    d.setDate(28);
    return d.toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" });
};
export const defaultAccounts = {
    totalBalance: 2512523.75,
    savings: { number: "•••• 4521", balance: 1524890.5, ifsc: "NEXA0001234" },
    current: { number: "•••• 8873", balance: 987633.25, ifsc: "NEXA0001234" },
    credit: {
        number: "•••• 2210",
        limit: 500000,
        used: 187500,
        dueDate: getNextCreditDueDate(),
        minDue: 9375,
    },
};
export const getSpendingByMonth = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const res = [];
    const baseSpends = [68400, 82150, 71300, 94800, 88250, 102400];
    const baseIncomes = [145000, 145000, 152000, 152000, 168000, 168000];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mName = months[d.getMonth()];
        const idx = 5 - i;
        res.push({
            month: mName,
            spend: baseSpends[idx],
            income: baseIncomes[idx],
        });
    }
    return res;
};
export const spendingByMonth = getSpendingByMonth();
export const spendingByCategory = [
    { name: "Shopping", value: 32400, color: "#22d3a5" },
    { name: "Food & Dining", value: 18750, color: "#a78bfa" },
    { name: "Travel", value: 24800, color: "#38bdf8" },
    { name: "Bills", value: 15200, color: "#fbbf24" },
    { name: "Entertainment", value: 8600, color: "#f472b6" },
];
export const defaultTransactions = [
    { id: "TXN9821A", title: "Salary — Novara Systems", category: "Salary", date: getRelativeDate(1, 9, 30), amount: 168000, type: "credit", status: "Completed", method: "NEFT" },
    { id: "TXN9822B", title: "Amazon India", category: "Shopping", date: getRelativeDate(2, 16, 45), amount: 4599, type: "debit", status: "Completed", method: "UPI" },
    { id: "TXN9823C", title: "Zomato", category: "Food & Dining", date: getRelativeDate(2, 20, 15), amount: 842, type: "debit", status: "Completed", method: "UPI" },
    { id: "TXN9824D", title: "IndiGo Airlines", category: "Travel", date: getRelativeDate(4, 11, 20), amount: 18420, type: "debit", status: "Completed", method: "Card" },
    { id: "TXN9825E", title: "Netflix Subscription", category: "Entertainment", date: getRelativeDate(5, 7, 0), amount: 649, type: "debit", status: "Completed", method: "Card" },
    { id: "TXN9826F", title: "Rent — Sunrise Apartments", category: "Bills", date: getRelativeDate(6, 10, 0), amount: 42000, type: "debit", status: "Completed", method: "NEFT" },
    { id: "TXN9827G", title: "Refund — Myntra", category: "Shopping", date: getRelativeDate(8, 14, 25), amount: 2199, type: "credit", status: "Completed", method: "UPI" },
    { id: "TXN9828H", title: "Uber", category: "Travel", date: getRelativeDate(10, 18, 50), amount: 312, type: "debit", status: "Completed", method: "UPI" },
    { id: "TXN9829I", title: "Electricity Bill — MSEDCL", category: "Bills", date: getRelativeDate(13, 11, 10), amount: 3184, type: "debit", status: "Completed", method: "Auto Debit" },
    { id: "TXN9830J", title: "Swiggy Instamart", category: "Food & Dining", date: getRelativeDate(16, 19, 40), amount: 1247, type: "debit", status: "Completed", method: "UPI" },
    { id: "TXN9831K", title: "Interest Credit", category: "Interest", date: getRelativeDate(20, 0, 1), amount: 3820, type: "credit", status: "Completed", method: "Internal" },
    { id: "TXN9832L", title: "Apple Services", category: "Entertainment", date: getRelativeDate(24, 8, 30), amount: 199, type: "debit", status: "Completed", method: "Card" },
    { id: "TXN9833M", title: "Transfer to R. Iyer", category: "Transfer", date: getRelativeDate(28, 15, 12), amount: 15000, type: "debit", status: "Completed", method: "IMPS" },
    { id: "TXN9834N", title: "Croma Electronics", category: "Shopping", date: getRelativeDate(34, 17, 45), amount: 27800, type: "debit", status: "Completed", method: "Card" },
];
// Helper to safely access browser storage
function getInitialAccounts() {
    if (typeof window === "undefined")
        return { ...defaultAccounts };
    try {
        const raw = localStorage.getItem("nexa_accounts");
        if (raw)
            return JSON.parse(raw);
    }
    catch { }
    return { ...defaultAccounts };
}
function getInitialTransactions() {
    if (typeof window === "undefined")
        return [...defaultTransactions];
    try {
        const raw = localStorage.getItem("nexa_transactions");
        if (raw)
            return JSON.parse(raw);
    }
    catch { }
    return [...defaultTransactions];
}
// In-memory singletons updated synchronously
export const accounts = getInitialAccounts();
export const transactions = getInitialTransactions();
/**
 * Deduct an amount from an account, recalculate totalBalance, and sync storage + listeners
 */
export function deductAccountBalance(accountType, amount) {
    const currentAcc = getInitialAccounts();
    const newBalance = Math.max(0, (currentAcc[accountType]?.balance || 0) - amount);
    currentAcc[accountType].balance = newBalance;
    currentAcc.totalBalance = currentAcc.savings.balance + currentAcc.current.balance;
    // Update exported memory object
    accounts[accountType].balance = newBalance;
    accounts.totalBalance = currentAcc.totalBalance;
    if (typeof window !== "undefined") {
        try {
            localStorage.setItem("nexa_accounts", JSON.stringify(currentAcc));
            window.dispatchEvent(new CustomEvent("nexa_bank_update"));
        }
        catch { }
    }
    return currentAcc;
}
/**
 * Record a new transaction at the top of the history
 */
export function recordTransaction(newTxn) {
    const currentList = getInitialTransactions();
    const updated = [newTxn, ...currentList];
    // Update in-memory export
    transactions.length = 0;
    transactions.push(...updated);
    if (typeof window !== "undefined") {
        try {
            localStorage.setItem("nexa_transactions", JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent("nexa_bank_update"));
        }
        catch { }
    }
    return updated;
}
/**
 * Reset bank store back to initial mock values
 */
export function resetBankStore() {
    if (typeof window !== "undefined") {
        try {
            localStorage.removeItem("nexa_accounts");
            localStorage.removeItem("nexa_transactions");
            window.dispatchEvent(new CustomEvent("nexa_bank_update"));
        }
        catch { }
    }
}
/**
 * React hook to subscribe to live account balances and transaction changes
 */
export function useBankStore() {
    const [liveAccounts, setLiveAccounts] = useState(() => getInitialAccounts());
    const [liveTransactions, setLiveTransactions] = useState(() => getInitialTransactions());
    useEffect(() => {
        const handleUpdate = () => {
            setLiveAccounts(getInitialAccounts());
            setLiveTransactions(getInitialTransactions());
        };
        window.addEventListener("nexa_bank_update", handleUpdate);
        window.addEventListener("storage", handleUpdate);
        // Initial sync
        handleUpdate();
        return () => {
            window.removeEventListener("nexa_bank_update", handleUpdate);
            window.removeEventListener("storage", handleUpdate);
        };
    }, []);
    return {
        accounts: liveAccounts,
        transactions: liveTransactions,
        deductBalance: deductAccountBalance,
        recordTransaction,
        resetBankStore,
    };
}
export const getUpcomingBills = () => {
    const now = new Date();
    const monthName = now.toLocaleDateString("en-IN", { month: "short" });
    return [
        { name: "Credit Card Bill", amount: 187500, due: `${monthName} 28`, icon: "CreditCard" },
        { name: "Home Loan EMI", amount: 42350, due: `${monthName} 05`, icon: "Home" },
        { name: "Mobile Postpaid", amount: 999, due: `${monthName} 12`, icon: "Smartphone" },
        { name: "Broadband", amount: 1499, due: `${monthName} 15`, icon: "Wifi" },
    ];
};
export const upcomingBills = getUpcomingBills();
export const investments = [
    { name: "Equity Mutual Funds", value: 842300, change: 12.4 },
    { name: "Fixed Deposits", value: 500000, change: 6.8 },
    { name: "Digital Gold", value: 128450, change: 8.1 },
    { name: "NPS", value: 214800, change: 9.2 },
];
export const beneficiaries = [
    { id: "b1", name: "Riya Iyer", nickname: "Riya", account: "•••• 3382", ifsc: "HDFC0001274", bank: "HDFC Bank", type: "IMPS" },
    { id: "b2", name: "Vikram Malhotra", nickname: "Dad", account: "•••• 6621", ifsc: "SBIN0005432", bank: "State Bank of India", type: "NEFT" },
    { id: "b3", name: "Sneha Kapoor", nickname: "Sneha K", account: "•••• 8890", ifsc: "ICIC0002198", bank: "ICICI Bank", type: "IMPS" },
    { id: "b4", name: "Arjun Rao", nickname: "Arjun", account: "•••• 1120", ifsc: "AXIS0004411", bank: "Axis Bank", type: "UPI" },
    { id: "b5", name: "Neha Verma", nickname: "Neha", account: "•••• 4409", ifsc: "KKBK0000958", bank: "Kotak Mahindra", type: "IMPS" },
];
export const cards = [
    {
        id: "c1",
        type: "Debit",
        tier: "Platinum",
        number: "4521 •••• •••• 8834",
        holder: "AARAV SHARMA",
        expiry: "08/29",
        network: "Visa",
        frozen: false,
        limitDaily: 200000,
        limitOnline: 150000,
        gradient: "linear-gradient(135deg, oklch(0.35 0.15 200), oklch(0.25 0.1 260))",
    },
    {
        id: "c2",
        type: "Credit",
        tier: "Signature",
        number: "5321 •••• •••• 2210",
        holder: "AARAV SHARMA",
        expiry: "04/28",
        network: "Mastercard",
        frozen: false,
        limitDaily: 500000,
        limitOnline: 500000,
        gradient: "linear-gradient(135deg, oklch(0.3 0.12 25), oklch(0.2 0.08 340))",
    },
    {
        id: "c3",
        type: "Credit",
        tier: "Business Metal",
        number: "3782 •••• •••• 4471",
        holder: "AARAV SHARMA",
        expiry: "11/30",
        network: "Amex",
        frozen: true,
        limitDaily: 1000000,
        limitOnline: 1000000,
        gradient: "linear-gradient(135deg, oklch(0.3 0.05 60), oklch(0.18 0.02 60))",
    },
];
export const notifications = [
    { id: "n1", title: "Salary Credited", body: "₹1,68,000 credited from Novara Systems", time: "2h ago", type: "success", icon: "Wallet" },
    { id: "n2", title: "UPI Payment Successful", body: "₹842 paid to Zomato via UPI", time: "5h ago", type: "info", icon: "Send" },
    { id: "n3", title: "Card Transaction", body: "₹27,800 spent at Croma using Signature card", time: "1d ago", type: "info", icon: "CreditCard" },
    { id: "n4", title: "EMI Reminder", body: "Home Loan EMI of ₹42,350 due on Aug 05", time: "1d ago", type: "warning", icon: "Bell" },
    { id: "n5", title: "New Login Detected", body: "Sign-in from iPhone 16 Pro · Mumbai", time: "2d ago", type: "info", icon: "Shield" },
    { id: "n6", title: "Interest Credited", body: "₹3,820 savings interest credited", time: "3d ago", type: "success", icon: "TrendingUp" },
    { id: "n7", title: "Statement Ready", body: "Your July account statement is available", time: "4d ago", type: "info", icon: "FileText" },
];
export const devices = [
    { name: "iPhone 16 Pro", location: "Mumbai, IN", lastActive: "Now", current: true },
    { name: "MacBook Air", location: "Mumbai, IN", lastActive: "2h ago", current: false },
    { name: "iPad Pro", location: "Pune, IN", lastActive: "3d ago", current: false },
];
export const formatINR = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
export const formatINRDetailed = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
