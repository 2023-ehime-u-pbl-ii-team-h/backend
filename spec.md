APIのパス:/token
概要:学生に出席申請するためのトークンを発行する。
HTTPメソッド:POST
引数:
 ヘッダ:
  Authorization:学生番号, Microsoftのパスワード
  Set-Cookie:学生番号
 本文:
  id(学生番号)相手を指定するため, JSON
戻り値:
 正常に処理できた時:200 OK, トークン(JSON形式)
 見せられるものがないとき:404 Not Found
 認証情報が足りないとき:401 Unauthorized

APIのパス:/attendance
概要:学生が打刻する
HTTPメソッド:POST
引数:
 本文:
  id(学生番号)相手を指定するため, JSON
  time(打刻日時)時間を指定するため, JSON
戻り値:
 正常に処理できたとき:200 OK
 見せられるものがないとき:404 Not Found
 認証情報が足りないとき:401 Unauthorized
 アクセス権がないとき:403 Forbidden