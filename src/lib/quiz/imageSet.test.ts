import { describe, it, expect } from 'vitest'
import { getOptionImage, type SingleImageOption, type GenderedImageOption } from './imageSet'

describe('getOptionImage', () => {
  const singleOpt: SingleImageOption = {
    id: 'opt1',
    label: 'Single option',
    weights: {},
    gradient: 'linear-gradient(...)',
    imageUrl: '/quiz/single.jpg',
  }

  const genderedOpt: GenderedImageOption = {
    id: 'opt2',
    label: 'Gendered option',
    weights: {},
    gradient: 'linear-gradient(...)',
    images: {
      masculine: '/quiz/m.jpg',
      feminine: '/quiz/f.jpg',
    },
  }

  it('SingleImageOption returns its imageUrl regardless of imageSet', () => {
    expect(getOptionImage(singleOpt, 'masculine', 0)).toBe('/quiz/single.jpg')
    expect(getOptionImage(singleOpt, 'feminine', 1)).toBe('/quiz/single.jpg')
    expect(getOptionImage(singleOpt, 'neutral', 2)).toBe('/quiz/single.jpg')
  })

  it('GenderedImageOption returns images.masculine when imageSet is "masculine"', () => {
    expect(getOptionImage(genderedOpt, 'masculine', 0)).toBe('/quiz/m.jpg')
    expect(getOptionImage(genderedOpt, 'masculine', 1)).toBe('/quiz/m.jpg')
  })

  it('GenderedImageOption returns images.feminine when imageSet is "feminine"', () => {
    expect(getOptionImage(genderedOpt, 'feminine', 0)).toBe('/quiz/f.jpg')
    expect(getOptionImage(genderedOpt, 'feminine', 1)).toBe('/quiz/f.jpg')
  })

  it('GenderedImageOption with imageSet "neutral" alternates based on questionIndex', () => {
    expect(getOptionImage(genderedOpt, 'neutral', 0)).toBe('/quiz/m.jpg')
    expect(getOptionImage(genderedOpt, 'neutral', 1)).toBe('/quiz/f.jpg')
    expect(getOptionImage(genderedOpt, 'neutral', 2)).toBe('/quiz/m.jpg')
    expect(getOptionImage(genderedOpt, 'neutral', 3)).toBe('/quiz/f.jpg')
  })

  it('does not throw for any valid input combination', () => {
    expect(() => getOptionImage(singleOpt, 'masculine', 0)).not.toThrow()
    expect(() => getOptionImage(genderedOpt, 'neutral', 0)).not.toThrow()
  })
})
