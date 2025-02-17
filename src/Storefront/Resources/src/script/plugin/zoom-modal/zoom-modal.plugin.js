import Plugin from 'src/script/plugin-system/plugin.class';
import PluginManager from 'src/script/plugin-system/plugin.manager';
import DeviceDetection from 'src/script/helper/device-detection.helper';
import Iterator from 'src/script/helper/iterator.helper';

/**
 * Zoom Modal Plugin
 */
export default class ZoomModalPlugin extends Plugin {

    static options = {

        /**
         * selector for the zoom modal
         */
        modalSelector: '.js-zoom-modal',

        /**
         * selector to trigger the image zoom modal
         */
        triggerSelector: 'img',

        /**
         * product id to load the images via ajax
         */
        productIdDataAttribute: 'data-product-id',

        /**
         * selector for the gallery slider inside the modal
         */
        modalGallerySliderSelector: '[data-modal-gallery-slider]',

        /**
         * selector for the initial gallery slider
         */
        parentGallerySliderSelector: '[data-gallery-slider]',

        /**
         * selector for gallery images which use the image zoom
         */
        imageZoomInitSelector: '[data-image-zoom]',

        /**
         * selector for the container of the gallery and the zoom modal
         */
        galleryZoomModalContainerSelector: '.js-gallery-zoom-modal-container',
    };

    init() {
        this._triggers = this.el.querySelectorAll(this.options.triggerSelector);

        this._registerEvents();
    }

    /**
     *
     * @private
     */
    _registerEvents() {
        const eventType = (DeviceDetection.isTouchDevice()) ? 'touchstart' : 'click';

        Iterator.iterate(this._triggers, element => {
            element.removeEventListener(eventType, this._onClick.bind(this));
            element.addEventListener(eventType, this._onClick.bind(this));
        });
    }

    /**
     *
     * @param event
     * @private
     */
    _onClick(event) {
        ZoomModalPlugin._stopEvent(event);
        this._openModal();

        this.$emitter.publish('onClick');
    }

    /**
     * @private
     */
    _openModal() {
        const galleryZoomModalContainer = this.el.closest(this.options.galleryZoomModalContainerSelector);
        const modal = galleryZoomModalContainer.querySelector(this.options.modalSelector);

        if (modal) {
            // execute all needed scripts for the slider
            const $modal = $(modal);

            $modal.off('show.bs.modal');
            $modal.on('show.bs.modal', () => {
                this._initSlider(modal);

                this.$emitter.publish('modalShow', { modal });
            });

            $modal.modal('show');
        }

        this.$emitter.publish('onClick', { modal });
    }

    /**
     * init the gallery slider or update the position of the slider
     *
     * @private
     */
    _initSlider(modal) {
        const slider = modal.querySelector(this.options.modalGallerySliderSelector);

        if (!slider) {
            return;
        }

        const parentSliderIndex = this._getParentSliderIndex();

        if (this.gallerySliderPlugin && this.gallerySliderPlugin._slider) {
            this.gallerySliderPlugin._slider.goTo(parentSliderIndex - 1);
            return;
        }

        PluginManager.initializePlugin('GallerySlider', slider, {
            slider: {
                startIndex: parentSliderIndex,
            },
            thumbnailSlider: {
                startIndex: parentSliderIndex,
                autoWidth: true,
                responsive: {
                    md: {
                        enabled: true,
                    },
                    lg: {
                        enabled: true,
                    },
                    xl: {
                        enabled: true,
                        axis: 'horizontal',
                    },
                },
            },
        });

        this.gallerySliderPlugin = PluginManager.getPluginInstanceFromElement(slider, 'GallerySlider');

        this._registerImageZoom();

        this.$emitter.publish('initSlider');
    }

    /**
     * register indexChanged callback to update the image zoom button state
     *
     * @private
     */
    _registerImageZoom() {
        this.gallerySliderPlugin._slider.events.on('indexChanged', () => {
            const activeSlideElement = this.gallerySliderPlugin.getActiveSlideElement();
            const activeImageZoomElement = activeSlideElement.querySelector(this.options.imageZoomInitSelector);
            const imageZoomPlugin = PluginManager.getPluginInstanceFromElement(activeImageZoomElement, 'ImageZoom');

            imageZoomPlugin._setActionButtonState();
        });
    }

    /**
     * returns the current index of the parent slider
     *
     * @return {number}
     * @private
     */
    _getParentSliderIndex() {
        let sliderIndex = 1;

        this._parentSliderElement = this.el.closest(this.options.parentGallerySliderSelector);

        if (this._parentSliderElement) {
            this._parentSliderPlugin = PluginManager.getPluginInstanceFromElement(this._parentSliderElement, 'GallerySlider');

            if (this._parentSliderPlugin) {
                sliderIndex = this._parentSliderPlugin.getCurrentSliderIndex();
            }
        }

        return sliderIndex === 0 ? 1 : sliderIndex + 1;
    }

    /**
     *
     * @param event
     * @private
     */
    static _stopEvent(event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
    }
}
