/**
 * Badge feature constants
 */

export const COURSERA_BASE_URL = 'https://www.coursera.org';
export const COURSERA_VERIFY_PATH = '/account/accomplishments/verify';

/**
 * Constructs a Coursera certificate verification URL
 * @param certId - The certificate ID
 * @returns Full verification URL
 */
export const getCourseraVerifyUrl = (certId: string): string => {
  return `${COURSERA_BASE_URL}${COURSERA_VERIFY_PATH}/${certId}`;
};
