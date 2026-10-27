(function initAuthBar() {
  const slot = document.getElementById("auth-profile-slot");
  if (!slot) return;

  fetch("/api/auth/me", { credentials: "include" })
    .then((res) => {
      if (!res.ok) throw new Error(`auth me ${res.status}`);
      return res.json();
    })
    .then((body) => {
      const user = body?.user;
      if (!user || typeof user !== "object") {
        slot.replaceWith(makeLink("/login", "Sign in", "login"));
        return;
      }
      const email = typeof user.email === "string" ? user.email : null;
      const id = typeof user.id === "string" ? user.id : null;
      if (!email && !id) {
        slot.replaceWith(makeLink("/login", "Sign in", "login"));
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "flex items-center gap-2";
      const initials = email ? email.slice(0, 2).toUpperCase() : "AU";
      const avatar = makeLink("#", initials, "account");
      avatar.title = email ?? "Signed in";
      avatar.removeAttribute("href");
      const signOut = document.createElement("form");
      signOut.method = "post";
      signOut.action = "/auth/signout";
      signOut.className = "inline";
      const btn = document.createElement("button");
      btn.type = "submit";
      btn.className =
        "font-label-sm text-label-sm uppercase tracking-widest text-quiet bg-transparent border-0 cursor-pointer hover:text-primary";
      btn.textContent = "Sign out";
      signOut.appendChild(btn);
      wrap.append(avatar, signOut);
      slot.replaceWith(wrap);
    })
    .catch((error) => {
      console.error("auth bar unavailable", error);
    });

  /** @param {string} href @param {string} text @param {string} kind */
  function makeLink(href, text, kind) {
    const a = document.createElement("a");
    a.href = href;
    a.className =
      "w-8 h-8 rounded-full bg-primary flex items-center justify-center font-figure-sm text-figure-sm text-on-primary uppercase no-underline";
    a.dataset.auth = kind;
    a.textContent = text.length <= 2 ? text : text.slice(0, 1);
    return a;
  }

})();
