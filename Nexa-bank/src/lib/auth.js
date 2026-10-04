const KEY = "nexabank_auth";
export function isAuthed() {
    if (typeof window === "undefined")
        return false;
    return localStorage.getItem(KEY) === "1";
}
export function signIn() {
    localStorage.setItem(KEY, "1");
}
export function signOut() {
    localStorage.removeItem(KEY);
}
