import "./css/blog.css";
export default function Blog() {
  return (
    <div className="blog-page">
      <div className="look-up">
        <input type="text" placeholder="Search" />
      </div>
      <div className="blogs"></div>
    </div>
  );
}
