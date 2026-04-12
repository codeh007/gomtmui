import MouseButtonMapper, { XVNC_BUTTONS } from "./kasm-rfb/core/mousebuttonmapper.js";

type KasmMessages = {
  videoEncodersRequest?: (...args: Array<unknown>) => void;
};

type KasmRfbLike = {
  messages?: KasmMessages;
  __gomtmVideoEncodersPatched?: boolean;
  mouseButtonMapper?: MouseButtonMapper;
};

export function createDefaultMouseButtonMapper() {
  const mapper = new MouseButtonMapper();
  mapper.set(0, XVNC_BUTTONS.LEFT_BUTTON);
  mapper.set(1, XVNC_BUTTONS.MIDDLE_BUTTON);
  mapper.set(2, XVNC_BUTTONS.RIGHT_BUTTON);
  mapper.set(3, XVNC_BUTTONS.BACK_BUTTON);
  mapper.set(4, XVNC_BUTTONS.FORWARD_BUTTON);
  return mapper;
}

export function configureKasmRfbInstance<T extends KasmRfbLike>(rfb: T) {
  if (rfb.mouseButtonMapper == null) {
    rfb.mouseButtonMapper = createDefaultMouseButtonMapper();
  }
  return rfb;
}

export function patchKasmRfbForGomtm<T extends KasmRfbLike>(RFB: T) {
  if (RFB.__gomtmVideoEncodersPatched) {
    return RFB;
  }

  // The local KasmVNC server currently rejects msgTypeVideoEncoders (184)
  // during the initial RFB handshake, which disconnects the session before
  // the first framebuffer update. Keep the patch isolated to the loader.
  if (typeof RFB.messages?.videoEncodersRequest === "function") {
    RFB.messages.videoEncodersRequest = () => {};
  }

  RFB.__gomtmVideoEncodersPatched = true;
  return RFB;
}

export async function loadKasmRfb() {
  const module = await import("./kasm-rfb/core/rfb.js");
  patchKasmRfbForGomtm(module.default as KasmRfbLike);
  return module;
}
