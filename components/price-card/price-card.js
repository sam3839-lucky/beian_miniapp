Component({
  properties: {
    unit: { type: Object, value: {} },
    project: { type: String, value: '' }
  },

  computed: {},

  observers: {
    'unit': function(u) {
      if (!u) return;
      const price = u.total_price > 0 ? u.total_price.toFixed(1) + '万' : '-';
      const area = u.built_area || '-';
      const up = u.unit_price ? (u.unit_price / 10000).toFixed(2) + '万/㎡' : '-';
      const date = u.permit_date || '';
      const bldg = (u.building_name || '').replace(this.properties.project, '');
      
      const saleType = u.sale_type || '';
      const isPresale = saleType === '预售';

      this.setData({
        priceText: price,
        areaText: area,
        unitPriceText: up,
        dateText: date,
        bldgName: bldg,
        saleType,
        isPresale
      });
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { unit: this.properties.unit });
    }
  }
});
