export const DEFAULT_PALETTE_INDEX = 0

export const DEFAULT_PALETTE = [
  '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399',
  '#8E44AD', '#16A085', '#E74C3C', '#2C3E50', '#D35400',
]

export const COLOR_PALETTES = [
  {
    name: '经典蓝',
    colors: ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#8E44AD', '#16A085', '#E74C3C', '#2C3E50', '#D35400'],
  },
  {
    name: '柔和',
    colors: ['#5B9BD5', '#ED7D31', '#A5A5A5', '#FFC000', '#4472C4', '#70AD47', '#264478', '#9B57A0', '#636363', '#EB7E30'],
  },
  {
    name: '鲜艳',
    colors: ['#E63946', '#F4A261', '#2A9D8F', '#264653', '#E9C46A', '#606C38', '#283618', '#BC6C25', '#DDA15E', '#FEFAE0'],
  },
  {
    name: '冷色',
    colors: ['#1B4965', '#5FA8D3', '#62B6CB', '#BEE9E8', '#CAD2C5', '#52796F', '#354F52', '#2F3E46', '#84A98C', '#344E41'],
  },
  {
    name: '暖色',
    colors: ['#D00000', '#E85D04', '#F48C06', '#FAA307', '#FFBA08', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#EF476F'],
  },
  {
    name: '彩虹',
    colors: ['#FF5722', '#FF9800', '#FFC107', '#4CAF50', '#2196F3', '#3F51B5', '#9C27B0', '#E91E63', '#00BCD4', '#795548'],
  },
  {
    name: '商务',
    colors: ['#2C3E50', '#34495E', '#1ABC9C', '#2ECC71', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#7F8C8D', '#95A5A6'],
  },
  {
    name: '自然',
    colors: ['#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2', '#B7E4C7', '#1B4332', '#081C15', '#006D77', '#83C5BE'],
  },
  {
    name: '科技',
    colors: ['#00F5D4', '#00BBF9', '#9B5DE5', '#F15BB5', '#FEE440', '#00BE67', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0'],
  },
  {
    name: '大地',
    colors: ['#8D6E63', '#A1887F', '#BCAAA4', '#795548', '#6D4C41', '#D7CCC8', '#5D4037', '#4E342E', '#3E2723', '#F5F5F5'],
  },
]

export const getPalette = (index) => COLOR_PALETTES[index]?.colors || DEFAULT_PALETTE
