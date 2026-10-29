const api = require('../../utils/api');

Page({
  data: {
    title: '',
    copyContent: '',
    platformIndex: 0,
    platforms: ['未知', '视频号', '抖音', '小红书', '快手', 'B站'],
    region: '',
    submitting: false,
    recentList: []
  },

  onShow() {
    // 选中第5个tab
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onContentInput(e) { this.setData({ copyContent: e.detail.value }); },
  onRegionInput(e) { this.setData({ region: e.detail.value }); },
  onPlatformChange(e) { this.setData({ platformIndex: e.detail.value }); },

  async onSubmit() {
    const content = this.data.copyContent.trim();
    if (!content) {
      wx.showToast({ title: '请粘贴文案内容', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const app = getApp();
    const openid = app.globalData.openid;

    try {
      const resp = await new Promise((resolve, reject) => {
        wx.request({
          url: app.globalData.baseUrl + '/api/swipe-collect',
          method: 'POST',
          data: {
            openid,
            title: this.data.title.trim(),
            copy_content: content,
            platform: this.data.platforms[this.data.platformIndex],
            region: this.data.region.trim()
          },
          timeout: 15000,
          success: resolve,
          fail: reject
        });
      });

      if (resp.data && resp.data.ok) {
        wx.showToast({ title: '入库成功', icon: 'success' });
        // 加入最近列表
        const item = {
          id: resp.data.id || Date.now(),
          title: this.data.title.trim() || content.slice(0, 30),
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        };
        this.setData({
          title: '',
          copyContent: '',
          region: '',
          recentList: [item, ...this.data.recentList].slice(0, 10)
        });
      } else {
        wx.showToast({ title: resp.data?.error || '入库失败', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '网络超时，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
