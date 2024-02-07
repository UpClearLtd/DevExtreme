/* eslint-disable max-classes-per-file */
import browser from '@js/core/utils/browser';
import { getHeight, getOuterWidth, getWidth } from '@js/core/utils/size';
import { isDefined } from '@js/core/utils/type';
import { hasWindow } from '@js/core/utils/window';

import { ColumnHeadersView } from '../column_headers/m_column_headers';
import { ColumnsController } from '../columns_controller/m_columns_controller';
import { ModuleType } from '../m_types';
import gridCoreUtils from '../m_utils';
import { RowsView } from '../views/m_rows_view';
import { createColumnsInfo } from './m_virtual_columns_core';

const DEFAULT_COLUMN_WIDTH = 50;

const rowsView = (Base: ModuleType<RowsView>) => class VirtualColumnsRowsViewExtender extends Base {
  _resizeCore() {
    // @ts-expect-error
    super._resizeCore.apply(this, arguments);
    // @ts-expect-error
    this._columnsController.resize();
  }

  _handleScroll(e) {
    const that = this;
    const scrollable = this.getScrollable();
    let { left } = e.scrollOffset;

    // @ts-expect-error
    super._handleScroll.apply(that, arguments);

    if (that.option('rtlEnabled') && scrollable) {
      left = getWidth(scrollable.$content()) - getWidth(scrollable.$element()) - left;
    }

    // @ts-expect-error
    that._columnsController.setScrollPosition(left);
  }

  _renderCore(e) {
    if (e?.virtualColumnsScrolling) {
      const $contentElement = this._findContentElement();
      const fixedColumns = this._columnsController?.getFixedColumns();
      const useNativeScrolling = this._scrollable?.option('useNative');

      if (fixedColumns?.length) {
        $contentElement.css({
          minHeight: useNativeScrolling ? getHeight($contentElement) : gridCoreUtils.getContentHeightLimit(browser),
        });

        const resizeCompletedHandler = () => {
          this.resizeCompleted.remove(resizeCompletedHandler);
          $contentElement.css({ minHeight: '' });
        };

        this.resizeCompleted.add(resizeCompletedHandler);
      }
    }

    // @ts-expect-error
    return super._renderCore.apply(this, arguments);
  }
};

const columnHeadersView = (Base: ModuleType<ColumnHeadersView>) => class VirtualColumnsColumnHeaderViewExtender extends Base {
  _renderCore() {
    // @ts-expect-error
    const deferred = super._renderCore.apply(this, arguments);

    // @ts-expect-error
    if (this._columnsController.isVirtualMode()) {
      this._updateScrollLeftPosition();
    }
    return deferred;
  }
};

const getWidths = function (columns) {
  return columns.map((column) => column.visibleWidth || parseFloat(column.width) || DEFAULT_COLUMN_WIDTH);
};

const columns = (Base: ModuleType<ColumnsController>) => class VirtualColumnsControllerExtender extends Base {
  private _beginPageIndex: any;

  private _endPageIndex: any;

  private _position: any;

  private _virtualVisibleColumns: any;

  private _renderTime: any;

  private _changedTimeout: any;

  init() {
    const that = this;
    // @ts-expect-error
    super.init.apply(this, arguments);

    that._beginPageIndex = null;
    that._endPageIndex = null;
    that._position = 0;
    that._virtualVisibleColumns = {};
  }

  resetColumnsCache() {
    super.resetColumnsCache();
    this._virtualVisibleColumns = {};
  }

  getBeginPageIndex(position) {
    const visibleColumns = this.getVisibleColumns(undefined, true);
    const widths = getWidths(visibleColumns);
    let currentPosition = 0;

    for (let index = 0; index < widths.length; index++) {
      if (currentPosition >= position) {
        return Math.floor(index / this.getColumnPageSize());
      }
      currentPosition += widths[index];
    }

    return 0;
  }

  getTotalWidth() {
    const width = this.option('width');
    if (typeof width === 'number') {
      return width;
    }
    return this.getController('resizing')._lastWidth || getOuterWidth(this.component.$element());
  }

  getEndPageIndex(position) {
    const visibleColumns = this.getVisibleColumns(undefined, true);
    const widths = getWidths(visibleColumns);
    let currentPosition = 0;

    position += this.getTotalWidth();

    for (let index = 0; index < widths.length; index++) {
      if (currentPosition >= position) {
        return Math.ceil(index / this.getColumnPageSize());
      }
      currentPosition += widths[index];
    }

    return Math.ceil(widths.length / this.getColumnPageSize());
  }

  getColumnPageSize() {
    return this.option('scrolling.columnPageSize');
  }

  _fireColumnsChanged() {
    const date: any = new Date();
    this.columnsChanged.fire({
      optionNames: { all: true, length: 1 },
      changeTypes: { columns: true, virtualColumnsScrolling: true, length: 2 },
    });
    this._renderTime = (new Date()) as any - date;
  }

  getScrollingTimeout() {
    const renderingThreshold = this.option('scrolling.columnRenderingThreshold');
    const renderAsync = this.option('scrolling.renderAsync');
    let scrollingTimeout = 0;

    if ((!isDefined(renderAsync) && this._renderTime > renderingThreshold) || renderAsync) {
      scrollingTimeout = this.option('scrolling.timeout');
    }

    return scrollingTimeout;
  }

  setScrollPosition(position) {
    const scrollingTimeout = this.getScrollingTimeout();

    if (scrollingTimeout > 0) {
      clearTimeout(this._changedTimeout);

      this._changedTimeout = setTimeout(() => {
        this._setScrollPositionCore(position);
      }, scrollingTimeout);
    } else {
      this._setScrollPositionCore(position);
    }
  }

  isVirtualMode() {
    return hasWindow() && this.option('scrolling.columnRenderingMode') === 'virtual';
  }

  resize() {
    this._setScrollPositionCore(this._position);
  }

  _setScrollPositionCore(position) {
    const that = this;

    if (that.isVirtualMode()) {
      const beginPageIndex = that.getBeginPageIndex(position);
      const endPageIndex = that.getEndPageIndex(position);
      const needColumnsChanged = position < that._position ? that._beginPageIndex > beginPageIndex : that._endPageIndex < endPageIndex;

      that._position = position;
      if (needColumnsChanged) {
        that._beginPageIndex = beginPageIndex;
        that._endPageIndex = endPageIndex;
        that._fireColumnsChanged();
      }
    }
  }

  getFixedColumns(rowIndex?, isBase?) {
    const fixedColumns = super.getFixedColumns(rowIndex);
    if (this.isVirtualMode() && !isBase && fixedColumns.length) {
      const transparentColumnIndex = fixedColumns.map((c) => c.command).indexOf('transparent');
      fixedColumns[transparentColumnIndex].colspan = this.getVisibleColumns().length - super.getFixedColumns().length + 1;
      return fixedColumns;
    }

    return fixedColumns;
  }

  _compileVisibleColumns(rowIndex, isBase?) {
    if (isBase || !this.isVirtualMode() || !this._shouldReturnVisibleColumns()) {
      return super._compileVisibleColumns(rowIndex);
    }

    if (this._columns?.length && !isDefined(this._beginPageIndex) && !isDefined(this._endPageIndex)) {
      this._beginPageIndex = this.getBeginPageIndex(this._position);
      this._endPageIndex = this.getEndPageIndex(this._position);
    }

    const beginPageIndex = this._beginPageIndex;
    const endPageIndex = this._endPageIndex;
    const visibleColumnsHash = `${rowIndex}-${beginPageIndex}-${endPageIndex}`;

    if (this._virtualVisibleColumns[visibleColumnsHash]) {
      return this._virtualVisibleColumns[visibleColumnsHash];
    }

    let visibleColumns = super._compileVisibleColumns();
    const rowCount = this.getRowCount();
    const pageSize = this.getColumnPageSize();
    let startIndex = beginPageIndex * pageSize;
    let endIndex = endPageIndex * pageSize;
    const fixedColumns = this.getFixedColumns(undefined, true);
    const transparentColumnIndex = fixedColumns.map((c) => c.command).indexOf('transparent');

    const beginFixedColumnCount = fixedColumns.length ? transparentColumnIndex : 0;
    let beginFixedColumns = visibleColumns.slice(0, beginFixedColumnCount);
    const beginColumns = visibleColumns.slice(beginFixedColumnCount, startIndex);
    const beginWidth = getWidths(beginColumns).reduce((a, b) => a + b, 0);

    if (!beginWidth) {
      startIndex = 0;
    }

    const endFixedColumnCount = fixedColumns.length ? fixedColumns.length - transparentColumnIndex - 1 : 0;
    let endFixedColumns = visibleColumns.slice(visibleColumns.length - endFixedColumnCount);
    const endColumns = visibleColumns.slice(endIndex, visibleColumns.length - endFixedColumnCount);
    const endWidth = getWidths(endColumns).reduce((a, b) => a + b, 0);

    if (!endWidth) {
      endIndex = visibleColumns.length;
    }

    if (rowCount > 1 && typeof rowIndex === 'number') {
      const columnsInfo: any = [];
      for (let i = 0; i <= rowCount; i++) {
        columnsInfo.push(super._compileVisibleColumns(i));
      }
      beginFixedColumns = createColumnsInfo(columnsInfo, 0, beginFixedColumns.length)[rowIndex] || [];
      endFixedColumns = createColumnsInfo(columnsInfo, visibleColumns.length - endFixedColumns.length, visibleColumns.length)[rowIndex] || [];
      visibleColumns = createColumnsInfo(columnsInfo, startIndex, endIndex)[rowIndex] || [];
    } else {
      visibleColumns = visibleColumns.slice(startIndex, endIndex);
    }

    if (beginWidth) {
      visibleColumns.unshift({ command: 'virtual', width: beginWidth });
      visibleColumns = beginFixedColumns.concat(visibleColumns);
    }

    if (endWidth) {
      visibleColumns.push({ command: 'virtual', width: endWidth });
      visibleColumns = visibleColumns.concat(endFixedColumns);
    }

    this._virtualVisibleColumns[visibleColumnsHash] = visibleColumns;

    return visibleColumns;
  }

  getColumnIndexOffset() {
    let offset = 0;
    if (this._beginPageIndex > 0) {
      const fixedColumns = this.getFixedColumns();
      const transparentColumnIndex = fixedColumns.map((c) => c.command).indexOf('transparent');
      const leftFixedColumnCount = transparentColumnIndex >= 0 ? transparentColumnIndex : 0;
      offset = this._beginPageIndex * this.getColumnPageSize() - leftFixedColumnCount - 1;
    }
    return offset > 0 ? offset : 0;
  }

  dispose() {
    clearTimeout(this._changedTimeout);
    // @ts-expect-error
    super.dispose.apply(this, arguments);
  }
};

export const virtualColumnsModule = {
  defaultOptions() {
    return {
      scrolling: {
        columnRenderingMode: 'standard',
        columnPageSize: 5,
        columnRenderingThreshold: 300,
      },
    };
  },
  extenders: {
    controllers: {
      columns,
    },
    views: {
      columnHeadersView,
      rowsView,
    },
  },
};
