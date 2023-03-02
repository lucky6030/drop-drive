import Firebase_Service from "../../module/firebase_service.js"
import Wrap from "../../module/wrap.js"
import Params_Check from "../../module/params_check.js"

import UUID from "../../module/uuid.js"
import System from "../../module/system.js"
import fs from "fs"

// 주어진 디렉토리에 대한 DATA URL을 반환받기 위해서(오버라이딩)
async function post_Router_Callback_Overide(req, res)
{    
  const USER_AUTH = await Firebase_Service.check_User_Auth()
  const {file_name:FILE_NAME, work_dir_path:WORK_DIR_PATH} 
    = Params_Check.Para_is_null_or_empty(req.body, ["file_name", "work_dir_path"])


  // 다운로드를 받으면서 실시간으로 다운로드률을 클라이어트측으로 전송시키기 위해서
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  
  const DOWNLOAD_MANAGER = new Download_Manager()
  await DOWNLOAD_MANAGER.download_Folder(FILE_NAME, WORK_DIR_PATH, USER_AUTH, (current_percentage) => {
    res.write(String(current_percentage))
  })


  // 다운로드 받은 zip DATA URL을 전송시키기 위해서
  res.write(`zip_data_url: ${DOWNLOAD_MANAGER.ZIP_DATA_URL}\n`)
  res.end()
}

/** 요청한 폴더에 대한 .zip 다운로드 URL을 얻기 위해서 */
class Download_Manager {
  constructor() {
    this.total_count = 0 
    this.current_count = 0
    this.ZIP_DATA_URL = ""
  }

  /** 주어진 클라우드 상의 폴더 내용을 다운받아서, ZIP_DATA_URL에 저장시키기 위해서 */
  async download_Folder(file_name, work_dir_path, user_auth, percentage_callback) {
    const TARGET_DIR_PATH = work_dir_path + file_name + "/"

    // 다운로드를 내용을 저장하기 위한 임시폴더를 생성시키기 위해서
    const FOLDER_UUID = UUID.get_UUID()
    const DOWNLOAD_FOLDER_PATH = `./downloads/${FOLDER_UUID}`
    fs.mkdirSync(DOWNLOAD_FOLDER_PATH)

    // 디렉토리 내용을 다운로드 받으면서 진행률을 전송시키기 위해서
    this.total_count = await this.__count_Files_Recursively(TARGET_DIR_PATH, user_auth)
    await this.__download_Directory_Recursively(DOWNLOAD_FOLDER_PATH, TARGET_DIR_PATH, user_auth, percentage_callback)
    
    // 다운받은 폴더를 .zip로 압축시키고, 그 내용을 Base64로 얻기 위해서
    await System.execute_Shell_Command(`cd ${DOWNLOAD_FOLDER_PATH};zip -r ../${FOLDER_UUID}.zip ./*`)
    const ZIP_PATH = `./downloads/${FOLDER_UUID}.zip`
    const ZIP_DATA_BASE64 = fs.readFileSync(ZIP_PATH, {encoding: 'base64'})
    this.ZIP_DATA_URL = "data:file/zip;base64," + ZIP_DATA_BASE64
    
    fs.rmSync(DOWNLOAD_FOLDER_PATH, {recursive: true, force: true})
    fs.rmSync(ZIP_PATH, {force: true})
  }

  /** 내부 디렉토리 내용을 재귀적으로 다운받아서 주어진 경로에 저장시키기 위해서 */
  async __download_Directory_Recursively(download_folder_path, work_dir_path, user_auth, percentage_callback) {
    const RESULT_TARGET_DIRECTORY_INFOS = await Firebase_Service.directory_File_Infos(work_dir_path, user_auth)
    if(RESULT_TARGET_DIRECTORY_INFOS.length == 0) return
    
    for(let sub_content_info of RESULT_TARGET_DIRECTORY_INFOS) {
      this.current_count++
      percentage_callback(Math.floor(this.current_count/this.total_count*100))
      
      if(sub_content_info.type == "directory") {
        const DOWNLOAD_SUB_FOLDER_PATH = `${download_folder_path}/${sub_content_info.file_name}`
        const WORK_DIR_PATH = work_dir_path + sub_content_info.file_name + '/'
        fs.mkdirSync(DOWNLOAD_SUB_FOLDER_PATH)
        await this.__download_Directory_Recursively(DOWNLOAD_SUB_FOLDER_PATH, WORK_DIR_PATH, user_auth, percentage_callback)
      }
      
      if(sub_content_info.type == "file") {
        const FILE_INFO = sub_content_info.file_name
        const [FILE_NAME, FILE_EXT] = FILE_INFO.split(".")
        const DATA_URL = await Firebase_Service.file_Data_URL(FILE_NAME, FILE_EXT, work_dir_path, user_auth)
        
        const FILE_CONTENT = atob(DATA_URL.split(',')[1])
        const DOWNLOAD_FILE_PATH = `${download_folder_path}/${FILE_INFO}`
        fs.writeFileSync(DOWNLOAD_FILE_PATH, FILE_CONTENT)
      }
    }
  }

  /** 현재 디렉토리에 속한 파일들의 총 개수를 얻기 위해서 */
  async __count_Files_Recursively(work_dir_path, user_auth) {
    let file_count = 0
    
    const RESULT_TARGET_DIRECTORY_INFOS = await Firebase_Service.directory_File_Infos(work_dir_path, user_auth)
    file_count += RESULT_TARGET_DIRECTORY_INFOS.length
    
    for(let sub_content_info of RESULT_TARGET_DIRECTORY_INFOS) {
      if(sub_content_info.type == "directory") {
        const WORK_DIR_PATH = work_dir_path + sub_content_info.file_name + '/'
        file_count += (await this.__count_Files_Recursively(WORK_DIR_PATH, user_auth))
      }
    }

    return file_count
  }  
}

post_Router_Callback_Overide = Wrap.Wrap_With_Try_Res_Promise(post_Router_Callback_Overide)

export default post_Router_Callback_Overide