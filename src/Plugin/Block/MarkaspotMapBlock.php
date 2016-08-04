<?php

namespace Drupal\markaspot_map\Plugin\Block;

use Drupal\Core\Block\BlockBase;

/**
 * Provides a 'Leaflet Map' Block.
 *
 * @Block(
 *   id = "markaspot_map_block",
 *   admin_label = @Translation("Markaspot Map"),
 * )
 */
class MarkaspotMapBlock extends BlockBase {

  /**
   * {@inheritdoc}
   */
  public function build() {
    return array(
      '#type' => 'markup',
      '#markup' => '<div id="map"></div>',
      '#attached' => array(
        'library' => array(
          'markaspot_map/leaflet',
          'markaspot_map/leaflet.awesome-markers',
          'markaspot_map/leaflet.easybutton',
          'markaspot_map/leaflet.fullscreen',
          'markaspot_map/waypoints',
          'markaspot_map/leaflet.heatmap',
          'markaspot_map/font-awesome',
          'markaspot_map/leaflet.timedimension',
          'markaspot_map/leaflet.transitionedicon',
          'markaspot_map/map',
        ),
      ),
    );
  }

}
