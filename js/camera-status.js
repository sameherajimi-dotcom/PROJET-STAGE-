const CameraStatusManager = {
    STORAGE_KEY: 'valeo_camera_status',

    init() {
        this.updateIndicator();

        setInterval(() => {
            this.updateIndicator();
        }, 1000);
    },

    updateIndicator() {
        const status =
            localStorage.getItem(
                this.STORAGE_KEY
            ) || 'off';

        const indicator =
            document.getElementById(
                'global-cam-indicator'
            );

        const text =
            document.getElementById(
                'globalCamText'
            );

        if (!indicator || !text) {
            return;
        }

        if (status === 'on') {

            indicator.querySelector('i').style.color =
                '#00cc66';

            text.textContent =
                'Caméra ON';

        } else {

            indicator.querySelector('i').style.color =
                '#ff4444';

            text.textContent =
                'Caméra OFF';

        }

    },

    setStatus(status) {
        localStorage.setItem(
            this.STORAGE_KEY,
            status
        );
    }

};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CameraStatusManager.init());
} else {
    CameraStatusManager.init();
}
