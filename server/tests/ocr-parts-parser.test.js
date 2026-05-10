const { __test__ } = require('../controllers/ocrController');

describe('OCR parts parser', () => {
  const makeWord = (text, x0, y0, x1, y1) => ({
    text,
    bbox: { x0, y0, x1, y1 },
  });

  test('handles the real noisy OCR dump from the order screenshot', () => {
    const input = `� ���������� \\ ������������ & @ �������� ֳ�� (���) ʳ������ ���� (���)
����� k �������� |
VICTOR REINZ 40-76149-00 �� 38
���� 5 38 1.
���������, �������; �� ��� Nas
�2 W105 fee �������� � 290
�������� �������� ������� �2 ����� � �� 145 - 2 - Pane
W105 5C0an (W105) or Fan
����. �������� 1
ELRING 147.581 a4 392 � 784
��������� ���������� ��������� � ��� ��
ELRING 318.580 meet 1538
��������� ������ KAZNAHIB ������ 4a 1538 -1. ��
{��������} �� ����
ELRING 135.500 ����. ������� |
ʳ���� ���������, �������� �� 52 - 6 - 313
�������� �� �� 11 �271 9, 2*14, 852.8 | ����� �� �����
(���-�� Eing) D>
����� � �������� |
���) BILSTEIN 10258 an 23 � 23
ʳ���� ��������� ���������� 5 + Angra
ELRING 914.495 Tan � �������� |
���������, ������� ������� BMW �� 2235 - 1 2235
�50825 MS0B2E -98 VANOS +0. IMM 2, | ������ Zap ������
DEMM (���-�� Eling) >
SWAG 20 03 0009 Na �������� 1 608
�������� ����� ������������ �� cna 7 �� 608 CE ����
������ SW 20030009 � er
ELRING 424.820 Ne at 635
�������� �������� {�-��) Mercedes ������ 635 CRE
� � Hz cant Son ����
���� Sprinter ��642
4
��� ������ |
VICTOR REINZ 14-32101-01 �� 985
14 32101-01 Victor Reinz �������� ������� 985 RE
� ie conan 4 oe Nyaa
����� SL BMW ��
+����� �������� |
BMW 11121726243 �� 164 �� 327
������ = 13, SMM MSO Su Tu CERIN
JP GROUP 1411000300 ia ��������! 519
�������� ���������� ������� BMW E36 �� �����? on 519 EE - �
Tenring 95-99 �� Airs
SKF VKM 38003 .
�� � ������ ������ |
����� ����������� � ������ �� 764
(�������) ���� 3 (G36), 3 �46), 3 (592). ������� ��� 764 Ss ho
3 (�93), 5 (E34). 5 (E39). 5 (E50). 5 (E61). � �
(E63), 6 (E64), 7 (���� �5 (EFA),
����� �������� |
FEBI BILSTEIN 06051 �� 658 � 558
����� ��� BMW 5���� {���-�� ���!) 47 �� PR.
�����`;

    const parts = __test__.parseOcrText(input, null);

    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          part_number: '147.581',
          price: 392,
          quantity: 2,
        }),
        expect.objectContaining({
          part_number: '20 03 0009',
          price: 608,
          quantity: 1,
        }),
        expect.objectContaining({
          part_number: '11121726243',
          price: 164,
          quantity: 2,
        }),
        expect.objectContaining({
          part_number: 'VKM 38003',
          price: 764,
          quantity: 1,
        }),
      ])
    );

    expect(parts.find((item) => item.part_number === '20 03 0009')).not.toEqual(
      expect.objectContaining({ price: 1608 })
    );
    expect(parts.filter((item) => item.part_number === '32101-01')).toHaveLength(0);
    expect(parts.filter((item) => item.price === 519 && !item.part_number)).toHaveLength(0);
  });

  test('prefers OCR attempt with better parsed parts, not just noisier raw text', () => {
    const weakButNoisy = {
      inputLabel: 'preprocessed',
      usedPath: 'preprocessed',
      psm: '6',
      rawText: `
        ELRING 147.581
        SWAG 20 03 0009
        BMW 11121726243
        SKF VKM 38003
        FEBI 06051
      `,
      parts: [
        {
          name: 'ELRING 147.581',
          price: 392,
          quantity: 2,
          part_number: '147.581',
        },
      ],
    };

    const strongerParsedAttempt = {
      inputLabel: 'original',
      usedPath: 'original',
      psm: '4',
      rawText: `
        ELRING 147.581 392 784
        BMW 11121726243 164 327
        SWAG 20 03 0009 608
      `,
      parts: [
        {
          name: 'Прокладка випускного колектора ELRING',
          price: 392,
          quantity: 2,
          part_number: '147.581',
        },
        {
          name: 'Втулка BMW',
          price: 164,
          quantity: 2,
          part_number: '11121726243',
        },
        {
          name: 'Натяжний ролик SWAG',
          price: 608,
          quantity: 1,
          part_number: '20 03 0009',
        },
      ],
    };

    const selection = __test__.selectBestPartsOcrAttempt([weakButNoisy, strongerParsedAttempt]);

    expect(selection.selectedMode).toBe('single');
    expect(selection.selectedUsedPath).toBe('original');
    expect(selection.selectedUsedPsm).toBe('4');
    expect(selection.selectedParts).toHaveLength(3);
    expect(selection.selectedParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ part_number: '147.581', price: 392, quantity: 2 }),
        expect.objectContaining({ part_number: '11121726243', price: 164, quantity: 2 }),
        expect.objectContaining({ part_number: '20 03 0009', price: 608, quantity: 1 }),
      ])
    );
  });

  test('merges complementary OCR attempts when ensemble yields better coverage', () => {
    const attemptA = {
      inputLabel: 'preprocessed',
      usedPath: 'preprocessed',
      psm: '6',
      rawText: `
        ELRING 147.581 392 784
        SWAG 20 03 0009 608
      `,
      parts: [
        {
          name: 'Прокладка випускного колектора ELRING',
          price: 392,
          quantity: 2,
          part_number: '147.581',
        },
        {
          name: 'Натяжний ролик SWAG',
          price: 608,
          quantity: 1,
          part_number: '20 03 0009',
        },
      ],
    };

    const attemptB = {
      inputLabel: 'original',
      usedPath: 'original',
      psm: '4',
      rawText: `
        BMW 11121726243 164 327
        ELRING 147.581 392 784
      `,
      parts: [
        {
          name: 'Втулка BMW 11121726243',
          price: 164,
          quantity: 2,
          part_number: '11121726243',
        },
        {
          name: 'Прокладка випускного колектора ELRING 147.581',
          price: 392,
          quantity: 2,
          part_number: '147.581',
        },
      ],
    };

    const selection = __test__.selectBestPartsOcrAttempt([attemptA, attemptB]);
    const partNumbers = selection.selectedParts.map((item) => item.part_number).sort();

    expect(selection.selectedMode).toBe('merged');
    expect(selection.selectedUsedPath).toBe('ensemble');
    expect(selection.selectedUsedPsm).toMatch(/^merge\(/);
    expect(partNumbers).toEqual(['11121726243', '147.581', '20 03 0009']);
  });

  test('structured table parser takes multiline description rows under sku rows', () => {
    const words = [
      makeWord('Найменування', 10, 10, 160, 26),
      makeWord('Коментар', 250, 10, 360, 26),
      makeWord('Ціна', 520, 10, 575, 26),
      makeWord('Кількість', 650, 10, 760, 26),
      makeWord('Сума', 790, 10, 845, 26),

      makeWord('ELRING', 20, 42, 82, 58),
      makeWord('147.581', 92, 42, 152, 58),
      makeWord('392', 525, 42, 555, 58),
      makeWord('2', 665, 42, 673, 58),
      makeWord('784', 792, 42, 822, 58),
      makeWord('Прокладка', 20, 64, 118, 80),
      makeWord('випускного', 128, 64, 228, 80),
      makeWord('колектора', 238, 64, 328, 80),

      makeWord('SWAG', 20, 88, 70, 104),
      makeWord('20', 80, 88, 96, 104),
      makeWord('03', 102, 88, 118, 104),
      makeWord('0009', 124, 88, 164, 104),
      makeWord('608', 525, 88, 555, 104),
      makeWord('Натяжний', 20, 110, 105, 126),
      makeWord('ролик', 115, 110, 168, 126),
      makeWord('поліклинового', 178, 110, 306, 126),
      makeWord('ременя', 316, 110, 384, 126),

      makeWord('BMW', 20, 134, 60, 150),
      makeWord('11121726243', 70, 134, 182, 150),
      makeWord('164', 525, 134, 555, 150),
      makeWord('2', 665, 134, 673, 150),
      makeWord('327', 792, 134, 822, 150),
      makeWord('Втулка', 20, 156, 84, 172),
      makeWord('13,', 94, 156, 116, 172),
      makeWord('SMM', 126, 156, 164, 172),
    ];

    const parts = __test__.parseOcrText('', { words });

    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Прокладка випускного колектора',
          part_number: '147.581',
          price: 392,
          quantity: 2,
        }),
        expect.objectContaining({
          name: 'Натяжний ролик поліклинового ременя',
          part_number: '20 03 0009',
          price: 608,
          quantity: 1,
        }),
        expect.objectContaining({
          name: 'Втулка 13, SMM',
          part_number: '11121726243',
          price: 164,
          quantity: 2,
        }),
      ])
    );
  });

  test('keeps descriptive names on the current real-world noisy receipt OCR dump', () => {
    const input = `У замовлення \\ Найменування & @      Коментар                Ціна (грк)              Кількість             Сума (грн)
термы k погтявки |
VICTOR REINZ 40-76149-00               да                                                                     38
ласт 5                    38               1.
Прокладха, іврмосіа;                    Са бое                                                         Nas
к2 W105                                   fee поставки С                                                       290
Очищунач гальмівної системи К2         нений в за                145              - 2 -             Pane
W105 5C0an (W105)                         or                                                                Fan
терм. псстаокА 1
ELRING 147.581                              a4                             392                    й                    784
Прокладка вигускного колектора         в топ                                                               ЕТ
ELRING 318.580                           meet                                                       1538
Прокладка кришки KAZNAHIB                насилає 4a                  1538               -1.               ще
{комплект}                          що                                                 Журн
ELRING 135.500                           терм. постави |
Кільце ущльнююче, клапанна            ла                           52               - 6 -              313
форсунка МВ МЗ 11 М271 9, 2*14, 852.8 | Вески дм                                                                пхати
(вир-во Eing)                             D>
Терим н ностевии |
РЕВ) BILSTEIN 10258                          an                                23                 і                      23
Кільце ущльнююче термостату            5 +                                                                   Angra
ELRING 914.495                                 Tan к поставим |
Прокладка, гопонка ципядра BMW       ла                           2235              - 1                  2235
М50825 MS0B2E -98 VANOS +0. IMM 2, | песклає Zap                                                              халати
DEMM (вир-во Eling)                      >
SWAG 20 03 0009                          Na поставки 1                                                        608
Нагнжний ролик поліклиноного         па cna 7 сп               608            CE           дінки
ременк SW 20030009                         Ш                                                                         er
ELRING 424.820                           Ne at                                                        635
Сальники клапанів {к-кт) Mercedes       несила                   635              CRE
й    Й                                  Hz cant Son                                                               жари
Вевг Sprinter ОМ642
4
тер погоню |
VICTOR REINZ 14-32101-01                аз                                                                    985
14 32101-01 Victor Reinz Комплект        посклан                    985             RE
Й                               ie conan 4 oe                                                    Nyaa
болтів SL BMW                          ту
+ериль поставии |
BMW 11121726243                        ла                          164              Ши                  327
Втулка = 13, SMM MSO                     Su Tu                                                                CERIN
JP GROUP 1411000300                    ia поставки!                                                        519
Пагрубок вентиляції картера BMW E36    Но силах? on                  519               EE -               Й
Tenring 95-99                            НА                                                      Airs
SKF VKM 38003                           .
щі             й                                           Зесмчи постав |
Ролик пОЛклиНнОвС о ременя                да                                                                                  764
(пластик) ВММУ 3 (G36), 3 Е46), 3 (592). налаляе чай                 764              Ss             ho
3 (Е93), 5 (E34). 5 (E39). 5 (E50). 5 (E61). Й                                                              п
(E63), 6 (E64), 7 (ЕЗЯХ Х5 (EFA),
Ферма поставки |
FEBI BILSTEIN 06051                      ла                          658              і                  558
Ролих ГРМ BMW 5КОРА {Вир-во РЕВ!)      47 еп                                                                          PR.
РАЗОМ`;

    const parts = __test__.parseOcrText(input, null);

    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          part_number: '40-76149-00',
          name: expect.stringMatching(/Прокладк|термостат/i),
          price: 38,
        }),
        expect.objectContaining({
          part_number: 'W105',
          name: expect.stringMatching(/Очищ|гальмів/i),
        }),
        expect.objectContaining({
          part_number: '147.581',
          name: expect.stringMatching(/Прокладк|колектор/i),
          price: 392,
          quantity: 2,
        }),
        expect.objectContaining({
          part_number: '20 03 0009',
          name: expect.stringMatching(/ролик|ремен/i),
          price: 608,
        }),
        expect.objectContaining({
          part_number: '424.820',
          name: expect.stringMatching(/Сальник|клапан/i),
          price: 635,
        }),
        expect.objectContaining({
          part_number: '11121726243',
          name: expect.stringMatching(/Втулк/i),
          price: 164,
          quantity: 2,
        }),
        expect.objectContaining({
          part_number: '1411000300',
          name: expect.stringMatching(/Патруб|вентиляц/i),
          price: 519,
        }),
        expect.objectContaining({
          part_number: 'VKM 38003',
          name: expect.stringMatching(/Ролик|ремен/i),
          price: 764,
        }),
        expect.objectContaining({
          part_number: '06051',
          name: expect.stringMatching(/Ролик|ГРМ/i),
          price: 658,
        }),
      ])
    );

    expect(parts.find((item) => item.part_number === '147.581')?.name).not.toBe('ELRING 147.581');
    expect(parts.find((item) => item.part_number === '20 03 0009')?.name).not.toBe('SWAG 20 03 0009');
    expect(parts.find((item) => item.part_number === '11121726243')?.name).not.toBe('BMW 11121726243');
  });

  test('fixes merged OCR regressions from the latest production order dump', () => {
    const input = `У замовлення \\ Найменування & @     Коментар               Ціна (грк)             Кількість             Сума (грн)

 терми OPT ERK |

 VICTOR REINZ 40-76149-00               да                           38               гі                   38
 Прокладка, іврмосіа;                    ©                                                                 Narre
 с
 к2 W105                                   Теплі поставки С                                                       290
 Очищунач гальмівної системи К2                                      145              2             aa
 W105 5C0an (W105)                                                                                            Fan
 теам.н necTaokA 1
 ELRING 147.581                              a4                             392                    й                    784
 Прокладка вигускного колекторо         В тб                                                               Atta
 ELRING 318.580                           meet                                                       1538
 hon нини                 Ha скло! 4 og                   1538               Sr               Куно
 | Ke       К                                  -
 й                                               ©
 ELRING 135.500                           терм. постави |
 Кільце ущльнююче, клапанна            ла                           52               - 6 -              313
 форсунка МВ МЗА1 М271 9. 2*14, 852.8 | Носклыа д п                                                          UTE
 (вир-во E¥ing)                             D>
 Терим н ностевии |
 РЕВ) BILSTEIN 10258                      дя                           23               з                   23
 Кільце ущльнююче термостату            3 Conant 4 ої                                                                   Дуда
 ELRING 914.495                                 Tan к поставим |
 Прокладка, голонка цилвндра BMW       ла                           2235              - 13.              2235
 М50825 М50В28 -98 МАМО5 +0. ЭММ 7, | пе склає 2 ор                                                            худа
 DEMM (вир-во Eling)
 SWAG 20 03 0009                          Na поставки 1                                                        608
 Нагнжний ролик поліклиноного          Й         й                  608              CE
 пасиляді 2 en                                                    PANTER
 ременк SW 20030009
 ELRING 424.820                           Na                                                        635
 Сальники клапанів {к-кт) Mercedes       несила                   635              CRE
 й                                      Ho склаг! Son                                                               жари
 Вевг Sprinter ОМ642                       @
 “4
 тер погоню |
 VICTOR REINZ 14-32101-01                а                                                                    985
 14 32101-01 Victor Renz Комплект        на скан Зоо                985             Е            име
 болтів ГБЦ BMW                          ту                                                                   п
 тери поставки |
 BMW 11121726243                        E
 11121728      ar    164   Sz.   327
 Втулка © = 13, SMM MSO                    © na ой                                                             CERIN
 JP GROUP 1411000300                    ia necro!                                                        519
 Пагрубок вентиляції картера BMW E36              Й                       519                EE -
 a                                        8 силам | on                                                            Asin as
 Тепгіпу 95-99                              Е
 SKF МКМ 38003                           N
 й                                           терми поставки |
 Ролик поліклинокого ременя                да                                                                                  764
 eons BMW 3 (636). 3{E46), 3 (F92). к лаги on                   764               - 1                   па
 (E63), 6 (E64), 7 (ЕЗЯХ Х5 (EFA),             ©
 Ферма поставки 1
 FEBI BILSTEIN 06051                      ла                          658              і                  558
 Ролих ГРМ BMW SKODA {Вир-во РЕВ!) meri tra                                                                          PR.

 о
 РАЗОМ`;

    const parts = __test__.parseOcrText(input, null);
    const thermostat = parts.find((item) => item.part_number === '40-76149-00');
    const cleaner = parts.find((item) => item.part_number === 'W105');
    const gasket = parts.find((item) => item.part_number === '914.495');
    const breather = parts.find((item) => item.part_number === '1411000300');
    const beltRoller = parts.find((item) => item.part_number === 'VKM 38003');

    expect(thermostat).toEqual(
      expect.objectContaining({
        part_number: '40-76149-00',
        name: expect.stringMatching(/Прокладк|термостат/i),
        price: 38,
        quantity: 1,
      })
    );
    expect(cleaner).toEqual(
      expect.objectContaining({
        part_number: 'W105',
        name: expect.stringMatching(/Очищ|гальмів/i),
        price: 145,
        quantity: 2,
      })
    );
    expect(gasket).toEqual(
      expect.objectContaining({
        part_number: '914.495',
        price: 2235,
        quantity: 1,
      })
    );
    expect(breather).toEqual(
      expect.objectContaining({
        part_number: '1411000300',
        price: 519,
        quantity: 1,
      })
    );
    expect(beltRoller).toEqual(
      expect.objectContaining({
        part_number: 'VKM 38003',
        name: expect.stringMatching(/Ролик|ремен/i),
        price: 764,
        quantity: 1,
      })
    );

    expect(parts.filter((item) => item.part_number === '32101-01')).toHaveLength(0);
    expect(parts.filter((item) => item.part_number === '11121728')).toHaveLength(0);
  });
});
