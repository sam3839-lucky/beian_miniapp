Page({
  data: {
    unit: {},
    project: '',
    building: '',
    area: '',
    unitPrice: '',
    totalPrice: '',
    status: '',
    statusColor: ''
  },

  onLoad(options) {
    try {
      const unit = JSON.parse(decodeURIComponent(options.data || '{}'));
      const project = decodeURIComponent(options.project || '');
      const building = decodeURIComponent(options.building || '');

      const area = (unit.built_area || '-') + '㎡';
      const up = unit.unit_price ? (unit.unit_price / 10000).toFixed(2) + '万/㎡' : '-';
      const tp = unit.total_price > 0 ? unit.total_price.toFixed(1) + '万' : '-';

      const statusMap = {
        '未售':   { text: '可售',     color: '#07C160' },
        '已网签': { text: '已网签',   color: '#FAAD14' },
        '已备案': { text: '已备案',   color: '#FF8C00' },
        '已转移登记': { text: '已转移登记', color: '#D9D9D9' }
      };
      const st = unit.status || '未售';
      const sm = statusMap[st] || { text: st, color: '#888' };

      this.setData({
        unit, project, building,
        area, unitPrice: up, totalPrice: tp,
        status: sm.text,
        statusColor: sm.color
      });
    } catch (e) {
      wx.showToast({ title: '数据错误', icon: 'none' });
    }
  }
});
