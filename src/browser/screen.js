"use strict";

/**
 * Adapter to use visual screen in browsers (in contrast to node)
 * @constructor
 *
 * @param {BusConnector} bus
 */
function ScreenAdapter(screen_container, bus) {
    console.assert(screen_container, "1st argument must be a DOM container");

    var
        graphic_screen = screen_container.getElementsByTagName("canvas")[0],
        graphic_context = graphic_screen.getContext("2d", {
            alpha: false
        }),
        loading_info = document.getElementById("loading_info");

    var
        graphic_image_data,
        graphic_buffer,
        graphic_buffer32,

        /** @type {number} */
        cursor_row,

        /** @type {number} */
        cursor_col,

        /** @type {number} */
        cursor_bg,

        /** @type {number} */
        cursor_fg,

        /** @type {boolean} */
        cursor_show,

        last_cursor = [0, 0, '#000000'],

        /** @type {number} */
        scale_x = 1,

        /** @type {number} */
        scale_y = 1,

        base_scale = 1,

        graphical_mode_width,
        graphical_mode_height,

        modified_pixel_min = 0,
        modified_pixel_max = 0,

        changed_rows,

        // are we in graphical mode now?
        is_graphical = false,

        // Index 0: ASCII code
        // Index 1: Background color
        // Index 2: Foreground color
        text_mode_data,

        // number of columns
        text_mode_width,

        // number of rows
        text_mode_height;

    var stopped = false;
    var is_loaded = false;

    var screen = this;

    const col_fix_type = parseInt(document.getElementById("color_fix").value, undefined);

    function col(n) {
        return "rgb(" + n[0] + ", " + n[1] + ", " + n[2] + ")";
    }

    function col_fix(n) {
        return "rgb(" + n[0] + 85 + ", " + n[1] + 85 + ", " + n[2] + ")";
    }

    const hex_to_rgb = hex =>
        hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b)
        .substring(1).match(/.{2}/g)
        .map(x => parseInt(x, 16));

    // 0x12345 -> "#012345"
    function number_as_color(n) {
        n = n.toString(16);
        n = "#" + Array(7 - n.length).join("0") + n;

        if (col_fix_type == 2)
            return n;
        if (col_fix_type == 0) {
            n = hex_to_rgb(n);
            if (n[0] == n[2] || n[1] == n[2] || n[0] == n[1] && n[0] == 0 && n[2] > 85)
                return col(n);
            return col_fix(n);
        }
        if (col_fix_type == 1)
            return n;
    }

    function set_info_status(text) {
        const padding = parseInt(360 - (text.length / 2 * 9), undefined);
        loading_info.style.paddingLeft = padding + "px";
        loading_info.style.width = (720 - padding) + "px";
        loading_info.textContent = text;
    }

    function process_text(text) {
        if (is_loaded) {
            if (text.startsWith("dodosjs_autoexec_file_stopped")) {
                if (confirm("Program finished. Do you want to exit?"))
                    location.href = "index.html";
            }
            return;
        }
        if (!text.trim())
            return;
        if (text.startsWith("  inflating: ")) {
            const zipfile = text.replace("inflating:", "").trim();
            set_info_status("Unzipping " + zipfile + "...");
            return;
        }
        if (text.startsWith("Starting MS-DOS...")) {
            set_info_status("Starting...");
            return;
        }
        if (text.startsWith("HIMEM is testing extended memory...")) {
            set_info_status("Testing memory...");
            return;
        }
        if (text.startsWith("starting_dodosjs_autoexec_file")) {
            set_info_status("Started!");
            is_loaded = true;
            graphic_screen.style.display = "block";
            loading_info.style.display = "none";
            return;
        }
        // console.log("%c" + text, "background-color: black; color: white;");
    }


    /**
     * Charmaps that constraint unicode sequences for the default dospage
     * @const
     */
    var charmap_high = new Uint16Array([
        0xC7, 0xFC, 0xE9, 0xE2, 0xE4, 0xE0, 0xE5, 0xE7,
        0xEA, 0xEB, 0xE8, 0xEF, 0xEE, 0xEC, 0xC4, 0xC5,
        0xC9, 0xE6, 0xC6, 0xF4, 0xF6, 0xF2, 0xFB, 0xF9,
        0xFF, 0xD6, 0xDC, 0xA2, 0xA3, 0xA5, 0x20A7, 0x192,
        0xE1, 0xED, 0xF3, 0xFA, 0xF1, 0xD1, 0xAA, 0xBA,
        0xBF, 0x2310, 0xAC, 0xBD, 0xBC, 0xA1, 0xAB, 0xBB,
        0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556,
        0x2555, 0x2563, 0x2551, 0x2557, 0x255D, 0x255C, 0x255B, 0x2510,
        0x2514, 0x2534, 0x252C, 0x251C, 0x2500, 0x253C, 0x255E, 0x255F,
        0x255A, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256C, 0x2567,
        0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256B,
        0x256A, 0x2518, 0x250C, 0x2588, 0x2584, 0x258C, 0x2590, 0x2580,
        0x3B1, 0xDF, 0x393, 0x3C0, 0x3A3, 0x3C3, 0xB5, 0x3C4,
        0x3A6, 0x398, 0x3A9, 0x3B4, 0x221E, 0x3C6, 0x3B5, 0x2229,
        0x2261, 0xB1, 0x2265, 0x2264, 0x2320, 0x2321, 0xF7,
        0x2248, 0xB0, 0x2219, 0xB7, 0x221A, 0x207F, 0xB2, 0x25A0, 0xA0
    ]);

    /** @const */
    var charmap_low = new Uint16Array([
        0x20, 0x263A, 0x263B, 0x2665, 0x2666, 0x2663, 0x2660, 0x2022,
        0x25D8, 0x25CB, 0x25D9, 0x2642, 0x2640, 0x266A, 0x266B, 0x263C,
        0x25BA, 0x25C4, 0x2195, 0x203C, 0xB6, 0xA7, 0x25AC, 0x21A8,
        0x2191, 0x2193, 0x2192, 0x2190, 0x221F, 0x2194, 0x25B2, 0x25BC
    ]);

    var charmap = [],
        chr;

    for (var i = 0; i < 256; i++) {
        if (i > 127) {
            chr = charmap_high[i - 0x80];
        } else if (i < 32) {
            chr = charmap_low[i];
        } else {
            chr = i;
        }

        charmap[i] = String.fromCharCode(chr);
    }

    graphic_context["imageSmoothingEnabled"] = false;

    graphic_screen.style.display = "none";

    this.bus = bus;

    bus.register("screen-set-mode", function(data) {
        this.set_mode(data);
    }, this);

    bus.register("screen-fill-buffer-end", function(data) {
        this.update_buffer(data);
    }, this);

    bus.register("screen-put-char", function(data) {
        //console.log(data);
        this.put_char(data[0], data[1], data[2], data[3], data[4]);
    }, this);

    bus.register("screen-update-cursor", function(data) {
        this.update_cursor(data[0], data[1]);
    }, this);

    bus.register("screen-clear", function() {
        this.clear_screen();
    }, this);

    bus.register("screen-set-size-text", function(data) {
        this.set_size_text(data[0], data[1]);
    }, this);
    bus.register("screen-set-size-graphical", function(data) {
        this.set_size_graphical(data[0], data[1], data[2], data[3]);
    }, this);


    this.init = function() {
        // not necessary, because this gets initialized by the bios early,
        // but nicer to look at
        this.set_size_text(80, 25);

        this.timer();
    };

    this.make_screenshot = function() {
        try {
            const image = new Image();
            image.src = graphic_screen.toDataURL("image/png");
            const w = window.open("");
            w.document.write(image.outerHTML);
            w.document.title = "Screenshot";
        } catch (e) {}
    };

    this.put_char = function(row, col, chr, bg_color, fg_color) {
        if (row < text_mode_height && col < text_mode_width) {
            var p = 3 * (row * text_mode_width + col);

            text_mode_data[p] = chr;
            text_mode_data[p + 1] = bg_color;
            text_mode_data[p + 2] = fg_color;

            changed_rows[row] = 1;
        }
    };

    this.timer = function() {
        if (!stopped) {
            requestAnimationFrame(is_graphical ? update_graphical : update_text);
        }
    };

    var update_text = function() {
        for (var i = 0; i < text_mode_height; i++) {
            if (changed_rows[i]) {
                screen.text_update_row(i);
                changed_rows[i] = 0;
            }
        }

        this.timer();
    }.bind(this);

    var update_graphical = function() {
        this.bus.send("screen-fill-buffer");
        this.timer();
    }.bind(this);

    this.destroy = function() {
        stopped = true;
    };

    this.set_mode = function(graphical) {
        is_graphical = graphical;

        if (graphical) {
            graphic_screen.width = graphical_mode_width;
            graphic_screen.height = graphical_mode_height;
            graphic_screen.style.width = graphical_mode_width * scale_x + "px";
            graphic_screen.style.height = graphical_mode_height * scale_y + "px";
            if (is_loaded)
                graphic_screen.style.display = "block";
        } else {
            if (is_loaded)
                graphic_screen.style.display = "block";
            graphic_screen.width = 720;
            graphic_screen.height = 400;
            graphic_screen.style.width = 720 * scale_x + "px";
            graphic_screen.style.height = 400 * scale_y + "px";
        }
        update_scale_graphic();
    };

    this.clear_screen = function() {
        graphic_context.fillStyle = "#000";
        graphic_context.fillRect(0, 0, graphic_screen.width, graphic_screen.height);
    };

    /**
     * @param {number} cols
     * @param {number} rows
     */
    this.set_size_text = function(cols, rows) {
        if (cols === text_mode_width && rows === text_mode_height) {
            return;
        }

        changed_rows = new Int8Array(rows);
        text_mode_data = new Int32Array(cols * rows * 3);

        text_mode_width = cols;
        text_mode_height = rows;

        for (var i = 0; i < rows; i++) {
            this.text_update_row(i);
        }

        update_scale_text();
    };

    this.set_size_graphical = function(width, height, buffer_width, buffer_height) {
        if (DEBUG_SCREEN_LAYERS) {
            // Draw the entire buffer. Useful for debugging
            // panning / page flipping / screen splitting code for both
            // v86 developers and os developers
            width = buffer_width;
            height = buffer_height;
        }

        if (is_loaded)
            graphic_screen.style.display = "block";

        graphic_screen.width = width;
        graphic_screen.height = height;

        //graphic_screen.style.width = width * scale_x + "px";
        //graphic_screen.style.height = height * scale_y + "px";

        // Make sure to call this here, because pixels are transparent otherwise
        //screen.clear_screen();

        graphic_image_data = graphic_context.createImageData(buffer_width, buffer_height);
        graphic_buffer = new Uint8Array(graphic_image_data.data.buffer);
        graphic_buffer32 = new Int32Array(graphic_image_data.data.buffer);

        graphical_mode_width = width;
        graphical_mode_height = height;

        // add some scaling to tiny resolutions
        if (graphical_mode_width <= 640) {
            base_scale = 2;
        } else {
            base_scale = 1;
        }

        this.bus.send("screen-tell-buffer", [graphic_buffer32], [graphic_buffer32.buffer]);
        update_scale_graphic();
    };

    this.set_scale = function(s_x, s_y) {
        scale_x = s_x;
        scale_y = s_y;

        update_scale_text();
        update_scale_graphic();
    };
    this.set_scale(scale_x, scale_y);

    function update_scale_text() {
        elem_set_scale(graphic_screen, scale_x, scale_y, true);
    }

    function update_scale_graphic() {
        elem_set_scale(graphic_screen, scale_x * base_scale, scale_y * base_scale, false);
        if (!is_graphical) {
            graphic_screen.style.width = 720 * scale_x + "px";
            graphic_screen.style.height = 400 * scale_y + "px";
            graphic_screen.width = 720;
            graphic_screen.height = 400;
        }
        if (is_graphical && graphical_mode_width == 320 && graphical_mode_height == 400) {
            graphic_screen.style.width = 640 * scale_x + "px";
            graphic_screen.style.height = 400 * scale_y + "px";
        } else if (is_graphical && graphical_mode_width == 320 && graphical_mode_height == 200) {
            graphic_screen.style.width = 640 * scale_x + "px";
            graphic_screen.style.height = 400 * scale_y + "px";
        } else if (is_graphical) {
            graphic_screen.width = graphical_mode_width;
            graphic_screen.height = graphical_mode_height;
            graphic_screen.style.width = graphical_mode_width * scale_x + "px";
            graphic_screen.style.height = graphical_mode_height * scale_y + "px";
        }
    }

    function elem_set_scale(elem, scale_x, scale_y, use_scale) {
        elem.style.width = "";
        elem.style.height = "";

        if (use_scale) {
            elem.style.transform = "";
        }

        var rectangle = elem.getBoundingClientRect();

        if (use_scale) {
            var scale_str = "";

            scale_str += scale_x === 1 ? "" : " scaleX(" + scale_x + ")";
            scale_str += scale_y === 1 ? "" : " scaleY(" + scale_y + ")";

            elem.style.transform = scale_str;
        } else {
            // unblur non-fractional scales
            if (scale_x % 1 === 0 && scale_y % 1 === 0) {
                graphic_screen.style["imageRendering"] = "crisp-edges"; // firefox
                graphic_screen.style["imageRendering"] = "pixelated";
                graphic_screen.style["-ms-interpolation-mode"] = "nearest-neighbor";
            } else {
                graphic_screen.style.imageRendering = "";
                graphic_screen.style["-ms-interpolation-mode"] = "";
            }

            // undo fractional css-to-device pixel ratios
            var device_pixel_ratio = window.devicePixelRatio || 1;
            if (device_pixel_ratio % 1 !== 0) {
                scale_x /= device_pixel_ratio;
                scale_y /= device_pixel_ratio;
            }
        }

        if (scale_x !== 1) {
            elem.style.width = rectangle.width * scale_x + "px";
        }
        if (scale_y !== 1) {
            elem.style.height = rectangle.height * scale_y + "px";
        }
    }

    this.update_cursor = function(row, col) {
        if (row !== cursor_row || col !== cursor_col) {
            changed_rows[row] = 1;
            changed_rows[cursor_row] = 1;

            cursor_row = row;
            cursor_col = col;
        }
    };

    function drawer_cursor() {
        if (!is_graphical) {
            cursor_show = !cursor_show;
            graphic_context.font = 'bold 15px bold Liberation Mono, DejaVu Sans Mono, Courier New, monospace';

            graphic_context.fillStyle = cursor_show ? cursor_fg : cursor_bg;
            graphic_context.fillRect(
                9 * cursor_col - 1,
                16 * cursor_row + 14,
                9,
                2
            );
        }
    }
    setInterval(drawer_cursor, 500);

    this.text_update_row = function(row) {
        var offset = 3 * row * text_mode_width;

        var bg_color,
            fg_color,
            text,
            bg,
            fg;

        for (var i = 0; i < text_mode_width;) {

            bg_color = text_mode_data[offset + 1];
            fg_color = text_mode_data[offset + 2];

            text = "";

            // put characters of the same color in one element
            while (i < text_mode_width &&
                text_mode_data[offset + 1] === bg_color &&
                text_mode_data[offset + 2] === fg_color) {
                var ascii = text_mode_data[offset];

                text += charmap[ascii];
                process_text(text);

                graphic_context.fillStyle = bg = number_as_color(bg_color);
                graphic_context.fillRect(
                    9 * i * scale_x,
                    16 * row * scale_y,
                    9 * charmap[ascii].length * scale_x,
                    16 * scale_y
                );

                graphic_context.font = 'bold 15px bold Liberation Mono, DejaVu Sans Mono, Courier New, monospace';

                graphic_context.fillStyle = fg = number_as_color(fg_color);
                graphic_context.fillText(
                    charmap[ascii],
                    9 * i * scale_x,
                    (16 * row + 12) * scale_y
                );

                if (cursor_show) graphic_context.fillStyle = cursor_fg;
                else graphic_context.fillStyle = cursor_bg;
                graphic_context.fillRect(
                    (9 * cursor_col - 1) * scale_x,
                    (16 * cursor_row + 14) * scale_y,
                    9 * scale_x,
                    2 * scale_y
                );
                if (last_cursor[0] !== cursor_row || last_cursor[1] !== cursor_col) {
                    graphic_context.fillStyle = last_cursor[2];
                    graphic_context.fillRect(
                        (9 * last_cursor[1] - 1) * scale_x,
                        (16 * last_cursor[0] + 14) * scale_y,
                        9 * scale_x,
                        2 * scale_y
                    );
                    last_cursor = [
                        cursor_row,
                        cursor_col,
                        cursor_bg
                    ];
                }

                i++;
                offset += 3;

                if (row === cursor_row) {
                    if (i === cursor_col || i === cursor_col + 1) {
                        cursor_bg = bg;
                        cursor_fg = fg;
                        break;
                    }
                }
            }
        }
    };

    this.update_buffer = function(layers) {
        if (DEBUG_SCREEN_LAYERS) {
            // Draw the entire buffer. Useful for debugging
            // panning / page flipping / screen splitting code for both
            // v86 developers and os developers
            graphic_context.putImageData(
                graphic_image_data,
                0, 0
            );

            // For each visible layer that would've been drawn, draw a
            // rectangle to visualise the layer instead.
            graphic_context.strokeStyle = "#0F0";
            graphic_context.lineWidth = 4;
            layers.forEach((layer) => {
                graphic_context.strokeRect(
                    layer.buffer_x,
                    layer.buffer_y,
                    layer.buffer_width,
                    layer.buffer_height
                );
            });
            graphic_context.lineWidth = 1;
            return;
        }

        layers.forEach((layer) => {
            graphic_context.putImageData(
                graphic_image_data,
                layer.screen_x - layer.buffer_x,
                layer.screen_y - layer.buffer_y,
                layer.buffer_x,
                layer.buffer_y,
                layer.buffer_width,
                layer.buffer_height
            );
        });
    };

    this.init();
}
