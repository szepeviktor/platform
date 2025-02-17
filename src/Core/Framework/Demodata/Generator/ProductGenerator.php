<?php declare(strict_types=1);

namespace Shopware\Core\Framework\Demodata\Generator;

use Doctrine\DBAL\Connection;
use Shopware\Core\Content\Product\Aggregate\ProductVisibility\ProductVisibilityDefinition;
use Shopware\Core\Content\Product\ProductDefinition;
use Shopware\Core\Defaults;
use Shopware\Core\Framework\Context;
use Shopware\Core\Framework\DataAbstractionLayer\EntityRepositoryInterface;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\Framework\DataAbstractionLayer\Search\EntitySearchResult;
use Shopware\Core\Framework\DataAbstractionLayer\Write\EntityWriterInterface;
use Shopware\Core\Framework\DataAbstractionLayer\Write\WriteContext;
use Shopware\Core\Framework\Demodata\DemodataContext;
use Shopware\Core\Framework\Demodata\DemodataGeneratorInterface;
use Shopware\Core\Framework\Util\Random;
use Shopware\Core\System\NumberRange\ValueGenerator\NumberRangeValueGeneratorInterface;

class ProductGenerator implements DemodataGeneratorInterface
{
    public const OPTIONS_WITH_MEDIA = 'with_media';

    /**
     * @var EntityWriterInterface
     */
    private $writer;

    /**
     * @var EntityRepositoryInterface
     */
    private $taxRepository;

    /**
     * @var Connection
     */
    private $connection;

    /**
     * @var NumberRangeValueGeneratorInterface
     */
    private $numberRangeValueGenerator;

    /**
     * @var ProductDefinition
     */
    private $productDefinition;

    public function __construct(
        EntityWriterInterface $writer,
        EntityRepositoryInterface $taxRepository,
        Connection $connection,
        NumberRangeValueGeneratorInterface $numberRangeValueGenerator,
        ProductDefinition $productDefinition
    ) {
        $this->writer = $writer;
        $this->taxRepository = $taxRepository;
        $this->connection = $connection;
        $this->numberRangeValueGenerator = $numberRangeValueGenerator;
        $this->productDefinition = $productDefinition;
    }

    public function getDefinition(): string
    {
        return ProductDefinition::class;
    }

    public function generate(int $numberOfItems, DemodataContext $context, array $options = []): void
    {
        $this->createProduct($context, $numberOfItems);
    }

    private function createProduct(DemodataContext $context, $count = 500): void
    {
        $visibilities = $this->buildVisibilities();

        $taxes = $this->getTaxes($context->getContext());
        $properties = $this->getProperties();

        $context->getConsole()->progressStart($count);

        $mediaIds = $context->getIds('media');

        $payload = [];
        for ($i = 0; $i < $count; ++$i) {
            $product = $this->createSimpleProduct($context, $taxes);
            $product['visibilities'] = $visibilities;

            if ($mediaIds) {
                $product['cover'] = [
                    'mediaId' => Random::getRandomArrayElement($mediaIds),
                ];
            }

            $productProperties = [];
            foreach ($properties as $groupId => $options) {
                $productProperties = array_merge(
                    $productProperties,
                    $context->getFaker()->randomElements($options, 3)
                );
            }

            $productProperties = array_slice($productProperties, 0, 20);

            $product['properties'] = array_map(function ($config) {
                return ['id' => $config];
            }, $productProperties);

            $payload[] = $product;

            if (\count($payload) >= 50) {
                $context->getConsole()->progressAdvance(\count($payload));
                $this->write($payload, $context);
                $payload = [];
            }
        }

        if (!empty($payload)) {
            $this->write($payload, $context);
        }

        $context->getConsole()->progressFinish();
    }

    private function write(array $payload, DemodataContext $context): void
    {
        $writeContext = WriteContext::createFromContext($context->getContext());

        $this->writer->upsert($this->productDefinition, $payload, $writeContext);
    }

    private function getTaxes(Context $context)
    {
        $tax = ['name' => 'High tax', 'taxRate' => 19];
        $this->taxRepository->create([$tax], $context);

        return $this->taxRepository->search(new Criteria(), $context);
    }

    private function createSimpleProduct(DemodataContext $context, EntitySearchResult $taxes): array
    {
        $price = random_int(1, 1000);
        $manufacturer = $context->getIds('product_manufacturer');
        $categories = $context->getIds('category');
        $rules = $context->getIds('rule');
        $tax = $taxes->get(array_rand($taxes->getIds()));
        $reverseTaxrate = 1 + ($tax->getTaxRate() / 100);

        $faker = $context->getFaker();
        $product = [
            'productNumber' => $this->numberRangeValueGenerator->getValue('product', $context->getContext(), null),
            'price' => [['currencyId' => Defaults::CURRENCY, 'gross' => $price, 'net' => $price / $reverseTaxrate, 'linked' => true]],
            'name' => $faker->productName,
            'description' => $faker->text(),
            'descriptionLong' => $this->generateRandomHTML(
                10,
                ['b', 'i', 'u', 'p', 'h1', 'h2', 'h3', 'h4', 'cite'],
                $context
            ),
            'taxId' => $tax->getId(),
            'manufacturerId' => $manufacturer[array_rand($manufacturer)],
            'active' => true,
            'categories' => [
                ['id' => $categories[array_rand($categories)]],
            ],
            'stock' => $faker->randomNumber(),
            'prices' => $this->createPrices($rules, $reverseTaxrate),
        ];

        return $product;
    }

    private function generateRandomHTML(int $count, array $tags, DemodataContext $context): string
    {
        $output = '';
        for ($i = 0; $i < $count; ++$i) {
            $tag = Random::getRandomArrayElement($tags);
            $text = $context->getFaker()->words(random_int(1, 10), true);
            $output .= sprintf('<%1$s>%2$s</%1$s>', $tag, $text);
            $output .= '<br/>';
        }

        return $output;
    }

    private function createPrices(array $rules, float $reverseTaxRate): array
    {
        $prices = [];
        $rules = \array_slice(
            $rules,
            random_int(0, \count($rules) - 5),
            random_int(1, 5)
        );

        foreach ($rules as $ruleId) {
            $gross = random_int(500, 1000);

            $prices[] = [
                'ruleId' => $ruleId,
                'quantityStart' => 1,
                'quantityEnd' => 10,
                'price' => [['currencyId' => Defaults::CURRENCY, 'gross' => $gross, 'net' => $gross / $reverseTaxRate, 'linked' => true]],
            ];

            $gross = random_int(1, 499);

            $prices[] = [
                'ruleId' => $ruleId,
                'quantityStart' => 11,
                'price' => [['currencyId' => Defaults::CURRENCY, 'gross' => $gross, 'net' => $gross / $reverseTaxRate, 'linked' => true]],
            ];
        }

        return $prices;
    }

    private function getProperties()
    {
        $options = $this->connection->fetchAll('SELECT LOWER(HEX(id)) as id, LOWER(HEX(property_group_id)) as property_group_id FROM property_group_option LIMIT 5000');

        $grouped = [];
        foreach ($options as $option) {
            $grouped[$option['property_group_id']][] = $option['id'];
        }

        return $grouped;
    }

    private function buildVisibilities()
    {
        $ids = $this->connection->fetchAll('SELECT LOWER(HEX(id)) as id FROM sales_channel LIMIT 100');

        return array_map(function ($id) {
            return ['salesChannelId' => $id['id'], 'visibility' => ProductVisibilityDefinition::VISIBILITY_ALL];
        }, $ids);
    }
}
