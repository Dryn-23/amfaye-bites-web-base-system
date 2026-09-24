export async function api(path, options = {}) {
  const token = localStorage.getItem("ab-token");
  let res;
  try {
    res = await fetch(`${import.meta.env.VITE_API_URL || "/api"}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error(
      "Cannot reach the bakery right now. Check your connection and try again.",
    );
  }
  const data = await res
    .json()
    .catch(() => ({ message: "The server returned an unexpected response." }));
  if (!res.ok)
    throw Object.assign(new Error(data.message || "Something went wrong."), {
      status: res.status,
    });
  return data;
}
