/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2019 The noVNC Authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 *
 */

export default class RREDecoder {
  constructor() {
    this._subrects = 0;
  }

  decodeRect(x, y, width, height, sock, display, _depth, frame_id) {
    if (this._subrects === 0) {
      if (sock.rQwait("RRE", 4 + 4)) {
        return false;
      }

      this._subrects = sock.rQshift32();

      const color = sock.rQshiftBytes(4); // Background
      display.fillRect(x, y, width, height, color);
    }

    while (this._subrects > 0) {
      if (sock.rQwait("RRE", 4 + 8)) {
        return false;
      }

      const color = sock.rQshiftBytes(4);
      const sx = sock.rQshift16();
      const sy = sock.rQshift16();
      const swidth = sock.rQshift16();
      const sheight = sock.rQshift16();
      display.fillRect(x + sx, y + sy, swidth, sheight, color, frame_id);

      this._subrects--;
    }

    return true;
  }
}
