Component({
  properties: {
    title: { type: String, value: '' },
    ranges: { type: Array, value: [] },
    active: { type: Number, value: 0 }
  },

  methods: {
    onTap(e) {
      const index = parseInt(e.currentTarget.dataset.index);
      if (index === this.properties.active) {
        // 再次点击已选中 → 回到全部
        this.triggerEvent('change', { index: 0 });
      } else {
        this.triggerEvent('change', { index });
      }
    }
  }
});
