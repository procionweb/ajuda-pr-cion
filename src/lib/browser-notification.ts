export async function showBrowserNotification(
  title: string,
  body: string,
  tag: string,
  href: string,
) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;

  const showFromPage = () => {
    const notice = new Notification(title, { body, tag });
    notice.onclick = () => {
      window.focus();
      window.location.assign(href);
    };
  };

  if (document.visibilityState === "visible") {
    try {
      showFromPage();
      return true;
    } catch {
      // Some browsers only support notifications through a service worker.
    }
  }

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/notification-sw.js");
      // O registro inicial pode ainda estar instalando; aguarde a ativação.
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, { body, tag, data: { href } });
      return true;
    } catch {
      // The page notification below still works when service workers are unavailable.
    }
  }

  try {
    showFromPage();
    return true;
  } catch {
    return false;
  }
}
