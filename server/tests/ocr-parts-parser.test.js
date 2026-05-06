const { __test__ } = require('../controllers/ocrController');

describe('OCR parts parser', () => {
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
});
