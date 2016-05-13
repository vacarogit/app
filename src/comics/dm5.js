import 'whatwg-fetch';
import $ from 'jquery';

import Base from './base';

export default class DM5 extends Base {
  constructor(chapterID, options={}) {
    super();

    this.regex = /http\:\/\/(tel||www)\.dm5\.com(\/m\d+\/)/;
    this.baseURL = "http://www.dm5.com";

    this.chapterID = chapterID; // eg: m251123, with "m"
    this.cid = /^m(\d+)/.exec(chapterID)[1]; // 251123, without "m"
    this.comicURL = null;

    this.comicName = null;

    // simple data cache
    this.chapterCountData = {};
  }

  fullURL() {
    return(`${this.baseURL}/${this.chapterID}`);
  }

  getChapters() {
    return new Promise((resolve, reject) => {
      fetch(this.fullURL()).then(r => r.text()).then(response => {
        var chapterIndex = $(response);
        var navigationItem = $(chapterIndex.find('.view_logo2.bai_lj')[0]);
        var urls = navigationItem.children('a').map((_, a) => $(a).attr('href'));

        this.comicURL = `${this.baseURL}${urls[urls.length-2]}`;

        fetch(this.comicURL,
          {
            credentials: 'include',
            headers: {'cookie': 'isAdult=1'}
          }
        ).then(r => r.text()).then(response => {
          var comicIndex = $(response);
          var chapterInfos = comicIndex.find('.nr6.lan2>li>.tg').map((_, a) => {
            var _rawID = $(a).attr('href')
            return({
              title: $(a).attr('title'),
              link: this.joinBaseUrl(_rawID),
              cid: /^\/m(\d+)/.exec(_rawID)[1]
            })
          });

          this.comicName = comicIndex.find('.inbt_title_h2')[0].innerHTML;
          this.chapterInfos = chapterInfos;

          resolve(chapterInfos);
        })
      });
    });
  }

  getChapterURL(cid) {
    return(`${this.baseURL}/m${cid}`);
  }

  async getChapterImages(cid, callback=null) {
    var images = [];
    var imagesCount = await this.fetchImagesCount(cid);

    // images comes in pairs, we only concat them in odd
    // [12] 23 [34] 45 [56] 67 [78] 89 [9]
    // [12] 23 [34] 45 [56] 67 [78] 89 [910] 10
    // add sequtial callback handling
    for (var i = 1; i <= imagesCount; i++) {
      if (i % 2 == 1) {
        images = images.concat(await this.fetchImages(i, cid));
        if (callback) callback(images);
      }
    }

    return new Promise((resolve, reject) => {
      resolve(images);
    });
  }

  async fetchImagesCount(cid) {
    // cache exist
    if (this.chapterCountData[cid]) {
      return this.chapterCountData[cid];
    }

    var _html = await (await fetch(this.getChapterURL(cid))).text();
    var chapterDoc = $(_html);

    var imagesCount = chapterDoc.find('select#pagelist > option').length;
    this.chapterCountData[cid] = imagesCount;
    return imagesCount;
  }

  async fetchImages(page, cid) {
    // imageFetchUrl: http://www.dm5.com/m251731/chapterfun.ashx?cid=251731&page=2
    var imageJs = await (await fetch(`${this.imageFetchUrl(cid)}?${$.param({ cid: cid, page: page, key: null, language: 1 })}`)).text();

    return new Promise((resolve, reject) => {
      var images = eval(imageJs);
      // console.log(`fetchImages: ${images}`);
      resolve(images);
    });
  }

  imageFetchUrl(cid) {
    return [this.baseURL, `m${cid}`, 'chapterfun.ashx'].join('/');
  }

  joinBaseUrl(url) {
    // bad workaround :p
    return(`${this.baseURL}${url}`);
  }

}
