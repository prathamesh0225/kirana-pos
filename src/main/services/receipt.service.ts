export type ReceiptLine = {
  productName: string
  mrpPaise: number
  quantity: number
  freeQuantity: number
  ratePaise: number
  amountPaise: number
}

export type ReceiptPayment = {
  mode: 'cash' | 'upi' | 'mixed'
  paidPaise: number
  changePaise: number
}

export type ReceiptData = {
  billNumber: string
  dateTime: string
  customerName?: string
  customerMobile?: string
  lines: ReceiptLine[]
  payment: ReceiptPayment
  totalPaise: number
}

const SHOP_NAME = 'GURUMAULI SUPER SHOPEE'
const SHOP_ADDRESS = 'T.K.V Chowk, Patur'
const SHOP_PHONE = '7745887735'

function formatMoney(paise: number): string {
  return (paise / 100).toFixed(2)
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3).replace(/\.?0+$/, '')
}

function formatQty(quantity: number, freeQuantity: number): string {
  const qty = formatQuantity(quantity)

  if (freeQuantity > 0) {
    return `${qty}+${formatQuantity(freeQuantity)}F`
  }

  return qty
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function paymentModeLabel(mode: ReceiptPayment['mode']): string {
  switch (mode) {
    case 'cash':
      return 'CASH'

    case 'upi':
      return 'UPI'

    case 'mixed':
      return 'MIXED'
  }
}

export function buildReceiptHtml(data: ReceiptData): string {
  /*
   * Total MRP is based only on the charged quantity.
   *
   * Example:
   *
   * MRP = 20
   * QTY = 2
   * FREE = 1
   *
   * Total MRP = 20 × 2 = 40
   *
   * The free quantity is not included.
   */

  const totalMrpPaise = data.lines.reduce((total, line) => {
    return total + Math.round(line.mrpPaise * line.quantity)
  }, 0)

  /*
   * Discount is:
   *
   * Total MRP - Total Amount
   *
   * Never show a negative discount.
   */

  const discountPaise = Math.max(0, totalMrpPaise - data.totalPaise)

  const customerSection =
    data.customerName || data.customerMobile
      ? `
        <div class="customer">
          ${data.customerName ? `<div>${escapeHtml(data.customerName)}</div>` : ''}

          ${data.customerMobile ? `<div>${escapeHtml(data.customerMobile)}</div>` : ''}
        </div>
      `
      : ''

  const rows = data.lines
    .map((line) => {
      const qty = formatQty(line.quantity, line.freeQuantity)

      return `
        <tr>

          <td class="item-name">
            ${escapeHtml(line.productName)}
          </td>

          <td class="mrp">
            ${formatMoney(line.mrpPaise)}
          </td>

          <td class="qty">
            ${escapeHtml(qty)}
          </td>

          <td class="rate">
            ${formatMoney(line.ratePaise)}
          </td>

          <td class="amount">
            ${formatMoney(line.amountPaise)}
          </td>

        </tr>
      `
    })
    .join('')

  return `
<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8" />

  <style>

    /*
     * RP326
     *
     * Physical paper:
     * 80mm
     *
     * Safe content width:
     * 70mm
     */

    @page {
      size: 80mm auto;
      margin: 0;
    }

    html,
    body {

      margin: 0;
      padding: 0;

      width: 80mm;

      font-family:
        "Courier New",
        monospace;

      font-size: 10px;

      font-weight: 700;

      color: #000;
    }


    /*
     * MAIN RECEIPT
     */

    .receipt {

      width: 70mm;

      margin: 0 auto;

      padding-top: 2mm;
      padding-bottom: 4mm;

      box-sizing: border-box;

      font-weight: 700;
    }


    /*
     * HEADER
     */

    .header {
      text-align: center;
      font-weight: 700;
    }

    .shop-name {

      font-size: 15px;

      font-weight: 700;

      line-height: 1.2;

      margin-bottom: 2px;
    }

    .shop-address {

      font-size: 10px;

      font-weight: 700;

      line-height: 1.2;
    }

    .shop-phone {

      font-size: 10px;

      font-weight: 700;

      line-height: 1.2;

      margin-top: 1px;
    }


    /*
     * SEPARATOR
     */

    .separator {

      border-top:
        1px dashed #000;

      margin:
        5px 0;
    }


    /*
     * BILL INFORMATION
     */

    .bill-info {

      display: flex;

      justify-content:
        space-between;

      align-items:
        baseline;

      width: 100%;

      font-weight: 700;

      line-height: 1.4;
    }

    .bill-number {
      text-align: left;
      white-space: nowrap;
    }

    .bill-date {
      text-align: right;
      white-space: nowrap;
    }


    /*
     * CUSTOMER
     */

    .customer {

      margin-top: 3px;

      line-height: 1.3;

      font-weight: 700;
    }


    /*
     * ITEM TABLE
     *
     * Total width = 100%
     *
     * ITEM = 38%
     * MRP  = 15%
     * QTY  = 14%
     * RATE = 16%
     * AMT  = 17%
     */

    .items-table {

      width: 100%;

      border-collapse:
        collapse;

      table-layout:
        fixed;

      font-weight: 700;
    }


    .items-table th,
    .items-table td {

      padding:
        1px 0;

      margin: 0;

      font-weight: 700;

      vertical-align:
        top;
    }


    .items-table th {

      border-bottom:
        1px solid #000;

      padding-bottom: 3px;

      line-height: 1.2;
    }


    /*
     * ITEM
     */

    .items-table .item-name {

      width: 38%;

      text-align: left;

      padding-right: 1px;

      overflow-wrap:
        anywhere;

      word-break:
        break-word;
    }


    /*
     * MRP
     */

    .items-table .mrp {

      width: 15%;

      text-align: right;

      white-space: nowrap;
    }


    /*
     * QTY
     */

    .items-table .qty {

      width: 14%;

      text-align: right;

      white-space: nowrap;
    }


    /*
     * RATE
     */

    .items-table .rate {

      width: 16%;

      text-align: right;

      white-space: nowrap;
    }


    /*
     * AMOUNT
     */

    .items-table .amount {

      width: 17%;

      text-align: right;

      white-space: nowrap;
    }


    /*
     * SUMMARY
     */

    .summary {

      margin-top: 4px;

      font-weight: 700;

      line-height: 1.45;
    }

    .summary-row {

      display: flex;

      justify-content:
        space-between;

      align-items:
        baseline;

      width: 100%;

      font-weight: 700;
    }


    /*
     * FINAL TOTAL
     */

    .grand-total {

      font-size: 12px;

      font-weight: 700;

      margin-top: 1px;
    }


    /*
     * PAYMENT
     */

    .payment {

      margin-top: 4px;

      font-weight: 700;

      line-height: 1.45;
    }


    /*
     * FOOTER
     */

    .footer {

      text-align: center;

      margin-top: 7px;

      font-weight: 700;

      line-height: 1.4;
    }

  </style>

</head>


<body>

  <div class="receipt">


    <!-- HEADER -->

    <div class="header">

      <div class="shop-name">
        ${escapeHtml(SHOP_NAME)}
      </div>

      <div class="shop-address">
        ${escapeHtml(SHOP_ADDRESS)}
      </div>

      <div class="shop-phone">
        ${escapeHtml(SHOP_PHONE)}
      </div>

    </div>


    <div class="separator"></div>


    <!-- BILL INFO -->

    <div class="bill-info">

      <div class="bill-number">

        Bill No :
        ${escapeHtml(data.billNumber)}

      </div>

      <div class="bill-date">

        ${escapeHtml(data.dateTime)}

      </div>

    </div>


    ${customerSection}


    <div class="separator"></div>


    <!-- ITEMS -->

    <table class="items-table">

      <thead>

        <tr>

          <th class="item-name">
            ITEM
          </th>

          <th class="mrp">
            MRP
          </th>

          <th class="qty">
            QTY
          </th>

          <th class="rate">
            RATE
          </th>

          <th class="amount">
            AMT
          </th>

        </tr>

      </thead>


      <tbody>

        ${rows}

      </tbody>

    </table>


    <div class="separator"></div>


    <!-- TOTALS -->

    <div class="summary">


      <div class="summary-row">

        <span>
          TOTAL MRP
        </span>

        <span>
          ${formatMoney(totalMrpPaise)}
        </span>

      </div>


      <div class="summary-row">

        <span>
          DISCOUNT
        </span>

        <span>
          ${formatMoney(discountPaise)}
        </span>

      </div>


      <div
        class="summary-row grand-total"
      >

        <span>
          TOTAL AMT
        </span>

        <span>
          ${formatMoney(data.totalPaise)}
        </span>

      </div>


    </div>


    <div class="separator"></div>


    <!-- PAYMENT -->

    <div class="payment">


      <div class="summary-row">

        <span>
          PAYMENT
        </span>

        <span>
          ${paymentModeLabel(data.payment.mode)}
        </span>

      </div>


      <div class="summary-row">

        <span>
          PAID
        </span>

        <span>
          ${formatMoney(data.payment.paidPaise)}
        </span>

      </div>


      <div class="summary-row">

        <span>
          CHANGE
        </span>

        <span>
          ${formatMoney(data.payment.changePaise)}
        </span>

      </div>


    </div>


    <div class="separator"></div>


    <!-- FOOTER -->

    <div class="footer">

      <div>
        THANK YOU!
      </div>

      <div>
        VISIT AGAIN
      </div>

    </div>


  </div>

</body>

</html>
`
}
