import { Component, Mixin, State } from 'src/core/shopware';
import Criteria from 'src/core/data-new/criteria.data';
import template from './sw-promotion-detail.html.twig';
import errorConfig from './error-config.json';
import swPromotionDetailState from './state';

const { mapPageErrors } = Component.getComponentHelper();

Component.register('sw-promotion-detail', {
    template,

    inject: ['numberRangeService', 'repositoryFactory', 'context'],

    mixins: [
        Mixin.getByName('notification'),
        Mixin.getByName('placeholder'),
        Mixin.getByName('discard-detail-page-changes')('promotion')
    ],

    shortcuts: {
        'SYSTEMKEY+S': 'onSave',
        ESCAPE: 'onCancel'
    },

    props: {
        promotionId: {
            type: String,
            required: false,
            default: null
        }
    },

    data() {
        return {
            isSaveSuccessful: false,
            saveCallbacks: []
        };
    },

    metaInfo() {
        return {
            title: this.$createTitle(this.identifier)
        };
    },

    computed: {
        identifier() {
            return this.placeholder(this.promotion, 'name');
        },

        promotionRepository() {
            return this.repositoryFactory.create('promotion');
        },

        languageStore() {
            return State.getStore('language');
        },

        tooltipSave() {
            const systemKey = this.$device.getSystemKey();

            return {
                message: `${systemKey} + S`,
                appearance: 'light'
            };
        },
        tooltipCancel() {
            return {
                message: 'ESC',
                appearance: 'light'
            };
        },

        promotion: {
            get() {
                return this.$store.state.swPromotionDetail.promotion;
            },
            set(promotion) {
                this.$store.commit('swPromotionDetail/setPromotion', promotion);
            }
        },

        isLoading: {
            get() {
                return this.$store.state.swPromotionDetail.isLoading;
            },
            set(isLoading) {
                this.$store.commit('swPromotionDetail/setIsLoading', isLoading);
            }
        },

        discounts() {
            return this.$store.state.swPromotionDetail.discounts;
        },

        ...mapPageErrors(errorConfig)

    },

    beforeCreate() {
        this.$store.registerModule('swPromotionDetail', swPromotionDetailState);
    },

    created() {
        this.createdComponent();
    },

    beforeDestroy() {
        this.$store.unregisterModule('swPromotionDetail');
    },

    watch: {
        promotionId() {
            this.createdComponent();
        }
    },

    methods: {
        createdComponent() {
            // TODO check if numberrange is configured
            // if not show modal and link to settings!
            this.isLoading = true;
            if (!this.promotionId) {
                this.languageStore.setCurrentId(this.languageStore.systemLanguageId);
                this.promotion = this.promotionRepository.create(this.context);
                this.isLoading = false;
                return;
            }
            this.loadEntityData();
        },

        loadEntityData() {
            const criteria = new Criteria(1, 1);
            criteria.addAssociation('salesChannels');

            this.promotionRepository.get(this.promotionId, this.context, criteria).then((promotion) => {
                this.promotion = promotion;
                this.isLoading = false;
            });
        },

        abortOnLanguageChange() {
            if (this.promotionRepository.hasChanges(this.promotion)) {
                return true;
            }

            if (this.discounts !== null) {
                const discountRepository = this.repositoryFactory.create(
                    this.discounts.entity,
                    this.discounts.source
                );

                return this.discounts.some((discount) => {
                    return discount.isNew() || discountRepository.hasChanges(discount);
                });
            }

            return false;
        },

        saveOnLanguageChange() {
            return this.onSave();
        },

        onChangeLanguage() {
            this.loadEntityData();
        },

        onSave() {
            this.isLoading = true;
            if (!this.promotionId) {
                return this.createPromotion();
            }

            return this.savePromotion();
        },

        createPromotion() {
            this.numberRangeService.reserve('promotion').then((promotionNumber) => {
                this.promotion.promotionNumber = promotionNumber;
                return this.savePromotion().then(() => {
                    this.$router.push({ name: 'sw.promotion.detail', params: { id: this.promotion.id } });
                });
            }).catch(() => {
                return this.savePromotion().then(() => {
                    this.$router.push({ name: 'sw.promotion.detail', params: { id: this.promotion.id } });
                });
            });
        },

        savePromotion() {
            const discounts = this.discounts === null ? this.promotion.discounts : this.discounts;
            const discountRepository = this.repositoryFactory.create(
                discounts.entity,
                discounts.source
            );

            return discountRepository.sync(discounts, discounts.context).then(() => {
                return this.promotionRepository.save(this.promotion, this.context).then(() => {
                    this.isSaveSuccessful = true;
                    const criteria = new Criteria(1, 1);
                    criteria.addAssociation('salesChannels');

                    return this.promotionRepository.get(this.promotion.id, this.context, criteria).then((promotion) => {
                        this.promotion = promotion;
                        this.isLoading = false;
                    });
                }).catch((error) => {
                    this.isLoading = false;
                    this.createNotificationError({
                        title: this.$tc('global.notification.notificationSaveErrorTitle'),
                        message: this.$tc(
                            'global.notification.notificationSaveErrorMessage',
                            0,
                            { entityName: this.promotion.name }
                        )
                    });
                    throw error;
                });
            });
        },

        onCancel() {
            this.$router.push({ name: 'sw.promotion.index' });
        }
    }
});
