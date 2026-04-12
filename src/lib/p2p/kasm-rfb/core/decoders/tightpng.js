/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2019 The noVNC Authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 *
 */

import TightDecoder from "./tight.js";

export default class TightPNGDecoder extends TightDecoder {
  _pngRect(x, y, width, height, sock, display, _depth, frame_id) {
    const data = this._readData(sock);
    if (data === null) {
      return false;
    }

    display.imageRect(x, y, width, height, "image/png", data, frame_id);

    return true;
  }

  _basicRect(_ctl, _x, _y, _width, _height, _sock, _display, _depth) {
    throw new Error("BasicCompression received in TightPNG rect");
  }
}
