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
});
