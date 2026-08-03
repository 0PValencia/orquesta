/**
 * Mientras el agente piensa, el TTY en modo cocido hace echo de flechas/scroll
 * como basura (^[[A, etc.). Este mute pone raw mode y descarta todo salvo Ctrl+C.
 */
import { stdin as input, stdout as output } from "node:process";

export type InputMuteHandle = {
  release: () => void;
};

export function muteInput(opts?: { onCtrlC?: () => void }): InputMuteHandle {
  if (!input.isTTY) {
    return { release: () => undefined };
  }

  const wasRaw = input.isRaw;
  // Apagar mouse por si quedó activo (scroll SGR → basura)
  try {
    output.write("\x1b[?1006l\x1b[?1000l\x1b[?1003l\x1b[?1015l");
  } catch {
    /* ignore */
  }

  const onData = (chunk: Buffer | string) => {
    const s = String(chunk);
    if (s === "\u0003") {
      opts?.onCtrlC?.();
      return;
    }
    // Descartar flechas, scroll, pegado, etc. — no echo
  };

  try {
    input.setRawMode(true);
  } catch {
    return { release: () => undefined };
  }
  input.resume();
  input.setEncoding("utf8");
  input.on("data", onData);

  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      input.off("data", onData);
      try {
        input.setRawMode(wasRaw ?? false);
      } catch {
        /* ignore */
      }
    },
  };
}
