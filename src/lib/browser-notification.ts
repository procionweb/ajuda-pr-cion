export async function showBrowserNotification(
  title: string,
  body: string,
  tag: string,
  href: string,
) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/notification-sw.js");
      await registration.showNotification(title, { body, tag, data: { href } });
      return true;
    } catch {
      // The page notification below still works when service workers are unavailable.
    }
  }

  try {
    const notice = new Notification(title, { body, tag });
    notice.onclick = () => {
      window.focus();
      window.location.assign(href);
    };
    return true;
  } catch {
    return false;
  }
}
