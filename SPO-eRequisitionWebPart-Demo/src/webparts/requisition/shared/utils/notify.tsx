// Centralised user notifications (SweetAlert). Keeps alert markup/theming out of
// the hook and components. Button colour/text are SweetAlert theming options.

import * as React from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const CONFIRM_BUTTON_COLOR = '#B7EB8F';
const CONFIRM_BUTTON_TEXT = '<span style="color: #02542D; font-weight: bold;">OK</span>';

/** Shows an error dialog with the given message. */
export function showErrorAlert(text: string): void {
  void MySwal.fire({
    title: <p>เกิดข้อผิดพลาด</p>,
    text,
    icon: 'error',
    confirmButtonColor: CONFIRM_BUTTON_COLOR,
    confirmButtonText: CONFIRM_BUTTON_TEXT,
  });
}

/** Shows a success dialog after data is saved. Pass `html` to override the default message. */
export function showSuccessAlert(html?: string): void {
  void MySwal.fire({
    title: <p>{html ? 'สำเร็จ' : 'แก้ไขข้อมูลเรียบร้อยแล้ว'}</p>,
    html,
    icon: 'success',
    confirmButtonColor: CONFIRM_BUTTON_COLOR,
    confirmButtonText: CONFIRM_BUTTON_TEXT,
  });
}

/** Shows a warning dialog (e.g. validation problems). `html` may contain markup. */
export function showWarningAlert(html: string): void {
  void MySwal.fire({
    title: <p>ตรวจสอบข้อมูล</p>,
    html,
    icon: 'warning',
    confirmButtonColor: CONFIRM_BUTTON_COLOR,
    confirmButtonText: CONFIRM_BUTTON_TEXT,
  });
}

/** Shows a confirm/cancel dialog. Resolves true when the user confirms. */
export async function showConfirmDialog(html: string, title = 'ยืนยันการทำรายการ'): Promise<boolean> {
  const result = await MySwal.fire({
    title: <p>{title}</p>,
    html,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: CONFIRM_BUTTON_COLOR,
    confirmButtonText: CONFIRM_BUTTON_TEXT,
    cancelButtonText: '<span style="font-weight: bold;">ยกเลิก</span>',
  });
  return result.isConfirmed === true;
}

/** Notifies the user that a promotion already exists for the chosen month (data loaded). */
export function showPromotionExistsAlert(tpmNo: string): void {
  void MySwal.fire({
    title: <p>พบข้อมูลโปรโมชันแล้ว</p>,
    html: `มีข้อมูลโปรโมชันสำหรับเดือนนี้แล้ว (${tpmNo})<br/>ระบบได้โหลดข้อมูลเดิมขึ้นมาให้แก้ไข`,
    icon: 'info',
    confirmButtonColor: CONFIRM_BUTTON_COLOR,
    confirmButtonText: CONFIRM_BUTTON_TEXT,
  });
}
