<?php declare(strict_types=1);

namespace Shopware\Core\Framework\Plugin\Command;

use Shopware\Core\Framework\Console\ShopwareStyle;
use Shopware\Core\Framework\Plugin;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

class BundleDumpCommand extends Command
{
    /**
     * @var Plugin\BundleConfigDumper
     */
    private $bundleDumper;

    public function __construct(Plugin\BundleConfigDumper $pluginDumper)
    {
        parent::__construct();

        $this->bundleDumper = $pluginDumper;
    }

    /**
     * {@inheritdoc}
     */
    protected function configure(): void
    {
        $this
            ->setName('bundle:dump')
            ->setAliases(['administration:dump:plugins', 'administration:dump:bundles'])
            ->setDescription('Creates a json file with the configuration for each active Shopware bundle.');
    }

    protected function execute(InputInterface $input, OutputInterface $output)
    {
        $this->bundleDumper->dump();

        $style = new ShopwareStyle($input, $output);
        $style->success('Dumped plugin configuration.');
    }
}
