import { useEffect, useRef, useState } from "react";
import { ImagePlus, X, Download } from "lucide-react";
import "./chatImages.css";
const root = import.meta.env.VITE_API_URL || "/api";
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem("ab-token") || ""}`,
});
export async function sendImageMessage(chat, file, message) {
  const body = new FormData();
  body.append("image", file);
  body.append("text", message.text);
  body.append("clientMessageId", message.clientMessageId);
  let response;
  try {
    response = await fetch(`${root}/chats/${chat}/image-messages`, {
      method: "POST",
      headers: headers(),
      body,
    });
  } catch {
    throw new Error(
      "Image could not be sent. Check your connection and retry.",
    );
  }
  const data = await response
    .json()
    .catch(() => ({
      message: "The server returned an unexpected upload response.",
    }));
  if (!response.ok)
    throw Object.assign(new Error(data.message || "Image could not be sent."), {
      status: response.status,
      retryAfter: data.retryAfter,
    });
  return data;
}
function usePreview(file) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return url;
}
export function ImagePicker({ file, onChange, disabled, onError }) {
  const input = useRef(null),
    url = usePreview(file);
  function choose(e) {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      onError(
        "Choose a JPEG, PNG or WebP image. HEIC, GIF and SVG are not supported.",
      );
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      onError("Images must be 5 MB or smaller.");
      return;
    }
    onError("");
    onChange(selected);
  }
  return (
    <div className="chat-image-picker">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose chat image"
        onChange={choose}
        disabled={disabled}
        hidden
      />
      <button
        className="button outline small"
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled}
      >
        <ImagePlus size={16} />
        {file ? "Change image" : "Attach image"}
      </button>
      <small>JPEG, PNG or WebP · up to 5 MB · one image per message</small>
      {file && (
        <div className="chat-image-draft">
          {url && <img src={url} alt="Selected image preview" />}
          <div>
            <b>{file.name}</b>
            <small>Ready to send · optional caption below</small>
          </div>
          <button
            className="icon-btn"
            type="button"
            aria-label="Remove attached image"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
export default function ChatImage({ conversation, message, onReady }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [visible, setVisible] = useState(false);
  const holder = useRef(null),
    dialog = useRef(null);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "150px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let live = true,
      objectUrl;
    const controller = new AbortController();
    setError("");
    fetch(`${root}/chats/${conversation}/messages/${message._id}/image`, {
      headers: headers(),
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok)
          throw new Error(
            "Image unavailable. Check your connection or sign in again.",
          );
        return res.blob();
      })
      .then((blob) => {
        if (live) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((e) => {
        if (live && e.name !== "AbortError") setError(e.message);
      });
    return () => {
      live = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [conversation, message._id, visible, retry]);
  return (
    <div
      className="chat-image"
      ref={holder}
      style={{
        aspectRatio: `${message.attachment.width || 4} / ${message.attachment.height || 3}`,
      }}
    >
      {error ? (
        <div className="chat-image-error" role="alert">
          {error}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Retry image
          </button>
        </div>
      ) : url ? (
        <button
          className="chat-image-open"
          type="button"
          aria-label="View attached image"
          onClick={() => dialog.current?.showModal()}
        >
          <img
            src={url}
            alt="Image attached to this order conversation"
            onLoad={onReady}
          />
        </button>
      ) : (
        <span className="chat-image-loading">
          {visible ? "Loading image…" : "Image attachment"}
        </span>
      )}
      <dialog
        className="chat-image-dialog"
        ref={dialog}
        aria-label="Attached chat image"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="chat-image-dialog-tools">
          <span>Order chat image</span>
          <a
            href={url || undefined}
            download="chat-image.jpg"
            className="text-link"
          >
            <Download size={16} />
            Save image
          </a>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close image preview"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        {url && <img src={url} alt="Full-size chat attachment" />}
        <small>
          Images are resized for support. They do not verify payment.
        </small>
      </dialog>
    </div>
  );
}
