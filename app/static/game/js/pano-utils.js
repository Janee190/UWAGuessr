// pano-utils.js - Shared Pannellum helper

(function (global) {
    function buildViewer(containerId, imageUrl, options) {
        var opts = options || {};
        var tempImg = new Image();

        tempImg.onload = function () {
            var haov = typeof opts.haov === 'number' ? opts.haov : 360;
            var vaov = haov * (tempImg.naturalHeight / tempImg.naturalWidth);
            var minPitch = typeof opts.minPitch === 'number' ? opts.minPitch : (-(vaov / 2));
            var maxPitch = typeof opts.maxPitch === 'number' ? opts.maxPitch : ((vaov / 2));
            var initialPitch = typeof opts.pitch === 'number' ? opts.pitch : 0;
            var initialYaw = typeof opts.yaw === 'number' ? opts.yaw : 0;
            var initialHfov = typeof opts.hfov === 'number' ? opts.hfov : 85;

            var viewerOptions = {
                type: 'equirectangular',
                panorama: imageUrl,
                haov: haov,
                vaov: vaov,
                vOffset: 0,
                autoLoad: true,
                showControls: false,
                pitch: initialPitch,
                yaw: initialYaw,
                hfov: initialHfov,
                minPitch: minPitch,
                maxPitch: maxPitch,
                compass: false,
                mouseZoom: true,
                avoidShowingBackground: opts.avoidShowingBackground !== false,
            };

            if (typeof opts.minHfov === 'number') {
                viewerOptions.minHfov = opts.minHfov;
            }
            if (typeof opts.maxHfov === 'number') {
                viewerOptions.maxHfov = opts.maxHfov;
            }

            var viewer = pannellum.viewer(containerId, viewerOptions);

            viewer.on('load', function () {
                viewer.resize();
                viewer.setPitch(initialPitch);
                viewer.setYaw(initialYaw);
                viewer.setHfov(initialHfov);

                if (typeof opts.onReady === 'function') {
                    opts.onReady(viewer, { haov: haov, vaov: vaov, minPitch: minPitch, maxPitch: maxPitch });
                }
            });
        };

        tempImg.src = imageUrl;
    }

    global.UWAPano = global.UWAPano || {};
    global.UWAPano.buildViewer = buildViewer;
})(window);
