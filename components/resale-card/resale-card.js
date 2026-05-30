Component({
  properties: {
    layout: { type: String, value: '' },
    area: { type: Number, value: null },
    totalPrice: { type: Number, value: 0 },
    unitPrice: { type: Number, value: null },
    orientation: { type: String, value: '' },
    buildingType: { type: String, value: '' },
    date: { type: String, value: '' },
    source: { type: String, value: '' },
    recordId: { type: Number, value: null }
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { record: this.data });
    }
  }
});
