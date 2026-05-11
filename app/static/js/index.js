window.addEventListener('load', function () {
    setTimeout(function () {
        if (typeof Mazemap !== 'undefined') {
            const preloadMap = new Mazemap.Map({
                container: 'hidden-preload-map',
                campuses: 119,
                center: [115.818, -31.98],
                zoom: 15,
                zLevel: 1
            });

            preloadMap.once('idle', function () {
                preloadMap.remove();
            });
        }
    }, 800);
});